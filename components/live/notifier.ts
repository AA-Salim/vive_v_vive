"use client"

import { useSyncExternalStore } from "react"
import type { LiveEvent } from "@/lib/live/events"
import { notifyContent, pushPayload, type NotifyPlan } from "@/lib/live/notify"
import type { Viewer } from "@/lib/live/policy"
import type { LivePrefs } from "@/hooks/use-live-prefs"

export type NotifyPermission = "unsupported" | "default" | "granted" | "denied"
// unavailable: this browser or deployment cannot push. signed-out: push needs an account to address alerts.
export type PushStatus = "unavailable" | "signed-out" | "off" | "pending" | "on" | "error"

export interface NotifyState {
  permission: NotifyPermission
  // iPhone and iPad only notify from an installed app (Share > Add to Home Screen).
  needsInstall: boolean
  push: PushStatus
}

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""
const SYNC_KEY = "vvv-push-sync"
const RESYNC_MS = 3 * 60 * 60_000
const STALE_EVENT_MS = 10 * 60_000

const SERVER_STATE: NotifyState = { permission: "unsupported", needsInstall: false, push: "unavailable" }

let state: NotifyState = SERVER_STATE
let initialized = false
let registration: Promise<ServiceWorkerRegistration | null> | null = null
let serverPush = true
let syncing: Promise<void> | null = null
const listeners = new Set<() => void>()

function setState(patch: Partial<NotifyState>) {
  const next = { ...state, ...patch }
  if (next.permission === state.permission && next.needsInstall === state.needsInstall && next.push === state.push) return
  state = next
  listeners.forEach((listener) => listener())
}

function isIOS(): boolean {
  const ua = navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
}

export function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true
}

function readPermission(): NotifyPermission {
  if (typeof Notification === "undefined" || !("serviceWorker" in navigator)) return "unsupported"
  return Notification.permission === "granted" ? "granted" : Notification.permission === "denied" ? "denied" : "default"
}

const pushCapable = () => !!VAPID_PUBLIC_KEY && serverPush && "PushManager" in window && "serviceWorker" in navigator

function init() {
  if (initialized || typeof window === "undefined") return
  initialized = true
  const permission = readPermission()
  state = {
    permission,
    needsInstall: permission === "unsupported" && isIOS() && !isStandalone(),
    push: pushCapable() ? "off" : "unavailable",
  }
  const refresh = () => setState({ permission: readPermission() })
  document.addEventListener("visibilitychange", refresh)
  navigator.permissions
    ?.query({ name: "notifications" as PermissionName })
    .then((status) => status.addEventListener("change", refresh))
    .catch(() => undefined)
}

function subscribe(listener: () => void) {
  init()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function snapshot(): NotifyState {
  init()
  return state
}

export function useNotifyState(): NotifyState {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER_STATE)
}

export function getNotifyState(): NotifyState {
  return snapshot()
}

// No fetch handler and no cache: registering it never changes how the app loads.
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (registration) return registration
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return Promise.resolve(null)
  registration = navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then(() => navigator.serviceWorker.ready)
    .catch(() => null)
  return registration
}

// Must run inside a click: browsers only show the permission prompt for a user gesture.
export async function requestNotifications(): Promise<NotifyPermission> {
  init()
  if (state.permission === "unsupported") return "unsupported"
  void registerServiceWorker()
  try {
    await Notification.requestPermission()
  } catch {
    // Old Safari only has the callback form; the permission is read back below either way.
  }
  const permission = readPermission()
  setState({ permission })
  return permission
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  const raw = window.atob(padded)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

function sameKey(subscription: PushSubscription, key: Uint8Array): boolean {
  const current = subscription.options?.applicationServerKey
  if (!current) return true
  const bytes = new Uint8Array(current)
  return bytes.length === key.length && bytes.every((b, i) => b === key[i])
}

interface SyncRecord {
  endpoint: string
  userId: string
  quiet: boolean
  at: number
}

function readSync(): SyncRecord | null {
  try {
    const raw = window.localStorage.getItem(SYNC_KEY)
    return raw ? (JSON.parse(raw) as SyncRecord) : null
  } catch {
    return null
  }
}

function writeSync(record: SyncRecord | null) {
  try {
    if (record) window.localStorage.setItem(SYNC_KEY, JSON.stringify(record))
    else window.localStorage.removeItem(SYNC_KEY)
  } catch {}
}

const sendJson = (method: "POST" | "DELETE", body: unknown) =>
  fetch("/api/push/subscribe", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await registerServiceWorker()
  return reg ? reg.pushManager.getSubscription().catch(() => null) : null
}

async function ensureSubscription(reg: ServiceWorkerRegistration): Promise<PushSubscription> {
  const key = base64UrlToBytes(VAPID_PUBLIC_KEY)
  const existing = await reg.pushManager.getSubscription()
  if (existing && sameKey(existing, key)) return existing
  if (existing) await existing.unsubscribe().catch(() => false)
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
}

interface PushWish {
  userId: string | null
  notify: boolean
  quiet: boolean
}

async function runSync(wish: PushWish): Promise<void> {
  if (!pushCapable()) {
    setState({ push: "unavailable" })
    return
  }
  const wanted = wish.notify && readPermission() === "granted"
  if (!wanted) {
    const existing = await currentSubscription()
    const record = readSync()
    if (existing && !wish.notify) {
      if (record && wish.userId && record.userId === wish.userId) await sendJson("DELETE", { endpoint: existing.endpoint }).catch(() => null)
      await existing.unsubscribe().catch(() => false)
      writeSync(null)
    }
    setState({ push: wish.userId ? "off" : "signed-out" })
    return
  }
  if (!wish.userId) {
    setState({ push: "signed-out" })
    return
  }

  const reg = await registerServiceWorker()
  if (!reg) {
    setState({ push: "unavailable" })
    return
  }
  setState({ push: state.push === "on" ? "on" : "pending" })
  let subscription: PushSubscription
  try {
    subscription = await ensureSubscription(reg)
  } catch {
    setState({ push: "error" })
    return
  }

  const record = readSync()
  const fresh =
    record &&
    record.endpoint === subscription.endpoint &&
    record.userId === wish.userId &&
    record.quiet === wish.quiet &&
    Date.now() - record.at < RESYNC_MS
  if (fresh) {
    setState({ push: "on" })
    return
  }

  const res = await sendJson("POST", { ...subscription.toJSON(), quiet: wish.quiet }).catch(() => null)
  if (!res) {
    setState({ push: "error" })
    return
  }
  const body = (await res.json().catch(() => null)) as { push?: boolean; code?: string } | null
  if (res.status === 503 || (res.ok && body?.push === false)) {
    // The table is not migrated yet, or the server has no VAPID keys: tab notifications still work.
    serverPush = false
    writeSync(null)
    setState({ push: "unavailable" })
    return
  }
  if (!res.ok) {
    setState({ push: res.status === 401 ? "signed-out" : "error" })
    return
  }
  writeSync({ endpoint: subscription.endpoint, userId: wish.userId, quiet: wish.quiet, at: Date.now() })
  setState({ push: "on" })
}

// Brings this device's Web Push registration in line with the switches. Safe to call often: it only talks to
// the server when something changed, or every few hours so a device dropped from the list comes back.
export function syncPush(wish: PushWish): Promise<void> {
  init()
  const run = (syncing ?? Promise.resolve()).then(() => runSync(wish)).catch(() => setState({ push: "error" }))
  syncing = run
  return run
}

// Before signing out: this device stops receiving the account's alerts. The browser keeps its subscription so
// the next sign-in only has to register it again.
export async function forgetPushDevice(): Promise<void> {
  const record = readSync()
  if (!record) return
  writeSync(null)
  await sendJson("DELETE", { endpoint: record.endpoint }).catch(() => null)
  setState({ push: "signed-out" })
}

const visible = () => document.visibilityState === "visible" && document.hasFocus()

// Shows an OS notification for a live event while this tab is hidden or the window is not focused (the toast
// covers a focused tab). Goes through the service worker, which also dedupes against Web Push and other tabs.
export function notifyFromTab(event: LiveEvent, plan: NotifyPlan, viewer: Viewer, prefs: LivePrefs): boolean {
  if (!prefs.notify || readPermission() !== "granted" || visible()) return false
  if (viewer.userId && event.actor?.userId === viewer.userId) return false
  if (plan.userIds === null ? prefs.quiet : !viewer.userId || !plan.userIds.includes(viewer.userId)) return false
  const at = Date.parse(event.at)
  if (Number.isFinite(at) && Date.now() - at > STALE_EVENT_MS) return false
  const content = notifyContent(event, plan)
  if (!content) return false
  const payload = pushPayload(event, plan, content)
  void registerServiceWorker().then((reg) => {
    if (reg?.active) {
      reg.active.postMessage({ type: "vvv:notify", payload })
      return
    }
    try {
      new Notification(payload.title, { body: payload.body, tag: payload.tag, icon: "/icons/icon-192.png" })
    } catch {}
  })
  return true
}
