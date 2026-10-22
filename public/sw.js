// Vive v Vive service worker: OS notifications only. No fetch handler and no cache, so it never serves a
// stale app. Shows Web Push messages (app closed) and the tab's own alerts (app minimized or hidden), which
// it receives as "vvv:notify" messages, with one place for dedupe, coalescing and click handling.

const ICON = "/icons/icon-192.png"
const BADGE = "/icons/badge-96.png"
// Two alerts for the same tag this close together replace each other silently instead of buzzing twice.
const COALESCE_MS = 4000

const VIBRATE = {
  info: [70],
  hype: [60, 40, 120],
  royal: [80, 50, 80, 50, 160],
  roast: [120, 60, 60],
  danger: [90, 60, 90, 60, 90],
}

// Safari revokes push permission after pushes that show nothing, so it always gets a notification.
const ALWAYS_SHOW = /iPad|iPhone|iPod/.test(self.navigator.userAgent) ||
  (/Safari\//.test(self.navigator.userAgent) && !/Chrome|Chromium|CriOS|Android|Edg\//.test(self.navigator.userAgent))

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

const text = (value, max) => (typeof value === "string" ? value.slice(0, max) : "")

function appPath(url) {
  try {
    const parsed = new URL(url || "/", self.location.origin)
    return parsed.origin === self.location.origin ? parsed.pathname + parsed.search + parsed.hash : "/"
  } catch {
    return "/"
  }
}

function readPush(event) {
  if (!event.data) return null
  try {
    const data = event.data.json()
    return data && typeof data === "object" ? data : null
  } catch {
    const body = event.data.text()
    return body ? { title: "Vive v Vive", body } : null
  }
}

// The same event can arrive from several tabs and from Web Push within moments: show it once.
const recentIds = new Map()

function seen(id) {
  const now = Date.now()
  for (const [key, at] of recentIds) if (now - at > 60000) recentIds.delete(key)
  if (recentIds.has(id)) return true
  recentIds.set(id, now)
  return false
}

// mustShow: a push on Safari has to end with a notification, so a duplicate is shown again silently.
async function show(data, mustShow) {
  const tag = text(data.tag, 120) || "vvv"
  const id = text(data.id, 64)
  const duplicate = !!id && seen(id)
  if (duplicate && !mustShow) return
  const existing = await self.registration.getNotifications({ tag })
  const already = duplicate || (!!id && existing.some((n) => n.data && n.data.id === id))
  if (already && !mustShow) return
  const recent = already || existing.some((n) => n.data && Date.now() - (n.data.shownAt || 0) < COALESCE_MS)
  const tone = Object.prototype.hasOwnProperty.call(VIBRATE, data.tone) ? data.tone : "info"
  const action = text(data.action, 40)
  const options = {
    body: text(data.body, 300),
    tag,
    renotify: !recent,
    silent: already,
    icon: ICON,
    badge: BADGE,
    timestamp: Date.parse(data.at) || Date.now(),
    actions: action ? [{ action: "open", title: action }] : [],
    data: { id, url: appPath(data.url), shownAt: Date.now() },
  }
  if (!already) options.vibrate = VIBRATE[tone]
  await self.registration.showNotification(text(data.title, 120) || "Vive v Vive", options)
}

async function onPush(event) {
  const data = readPush(event) || { title: "Vive v Vive", body: "Something happened on the Rift." }
  if (!ALWAYS_SHOW) {
    // A focused, visible window already shows the in-app toast.
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    if (windows.some((client) => client.focused && client.visibilityState === "visible")) return
  }
  await show(data, ALWAYS_SHOW)
}

self.addEventListener("push", (event) => {
  event.waitUntil(onPush(event))
})

self.addEventListener("message", (event) => {
  const message = event.data
  if (message && message.type === "vvv:notify" && message.payload && typeof message.payload === "object") {
    event.waitUntil(show(message.payload, false))
  }
})

async function openApp(path) {
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
  const client = windows.find((c) => c.focused) || windows.find((c) => c.visibilityState === "visible") || windows[0]
  if (client) {
    try {
      await client.focus()
    } catch {}
    client.postMessage({ type: "vvv:navigate", url: path })
    return
  }
  await self.clients.openWindow(new URL(path, self.location.origin).href)
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  event.waitUntil(openApp(appPath(data.url)))
})

async function resubscribe(event) {
  const old = event.oldSubscription
  let next = event.newSubscription
  const key = old && old.options && old.options.applicationServerKey
  if (!next && key) next = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
  const send = (method, body) =>
    fetch("/api/push/subscribe", {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  if (next) await send("POST", next.toJSON())
  if (old && (!next || old.endpoint !== next.endpoint)) await send("DELETE", { endpoint: old.endpoint })
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(resubscribe(event).catch(() => undefined))
})
