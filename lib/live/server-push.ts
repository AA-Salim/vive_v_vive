import { createHash } from "node:crypto"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import type { LiveEvent } from "@/lib/live/events"
import { notifyContent, notifyPlan, pushPayload, type NotifyPlan } from "@/lib/live/notify"

interface VapidConfig {
  publicKey: string
  privateKey: string
  subject: string
}

interface AudienceRow {
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

export interface PushJob {
  plan: NotifyPlan
  client: Promise<SupabaseClient | null>
}

export interface PushReport {
  sent: number
  gone: number
  failed: number
}

const GATE_WINDOW_MS = 4_000
const SEND_TIMEOUT_MS = 8_000
const SCHEMA_RETRY_MS = 5 * 60_000

let schemaMissingUntil = 0
let serviceClient: SupabaseClient | null | undefined

// Push is off unless all three variables are set; everything else keeps working without them.
export function vapidConfig(): VapidConfig | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  const subject = process.env.VAPID_SUBJECT?.trim()
  if (!publicKey || !privateKey || !subject || !/^(mailto:|https:\/\/)/.test(subject)) return null
  return { publicKey, privateKey, subject }
}

// With SUPABASE_SERVICE_ROLE_KEY set, pushes also go out for events a signed-out request triggers (a timer
// that ran out while only a guest was watching). Without it, the signed-in caller's session reads the audience.
function serviceRoleClient(): SupabaseClient | null {
  if (serviceClient !== undefined) return serviceClient
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  serviceClient = key
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } })
    : null
  return serviceClient
}

// Called while the request scope is alive: the caller's client must be created before the response is sent.
export function preparePush(event: LiveEvent, callerClient: () => Promise<SupabaseClient | null>): PushJob | null {
  if (Date.now() < schemaMissingUntil || !vapidConfig()) return null
  const plan = notifyPlan(event)
  if (!plan) return null
  const service = serviceRoleClient()
  return { plan, client: service ? Promise.resolve(service) : callerClient() }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Topic lets the push service drop an undelivered older message for the same notification (max 32 url-safe chars).
const topicOf = (tag: string) => createHash("sha256").update(tag).digest("base64url").slice(0, 32)

function schemaMissing(error: { code?: string; message?: string } | null): boolean {
  if (!isMissingSchema(error)) return false
  schemaMissingUntil = Date.now() + SCHEMA_RETRY_MS
  return true
}

async function passGate(client: SupabaseClient, scope: string, eventId: string): Promise<boolean> {
  const first = await client.rpc("push_gate", { p_key: scope, p_event: eventId, p_window_ms: GATE_WINDOW_MS })
  if (first.error) {
    schemaMissing(first.error)
    return false
  }
  const wait = Number(first.data)
  if (wait === 0) return true
  if (!(wait > 0)) return false
  await sleep(wait)
  const retry = await client.rpc("push_gate", { p_key: scope, p_event: eventId, p_window_ms: GATE_WINDOW_MS, p_retry: true })
  return !retry.error && Number(retry.data) === 0
}

function statusOf(reason: unknown): number {
  const code = (reason as { statusCode?: unknown } | null)?.statusCode
  return typeof code === "number" ? code : 0
}

// Sends one live event to every device in its audience. Never throws.
export async function deliverPush(event: LiveEvent, job: PushJob): Promise<PushReport | null> {
  try {
    const vapid = vapidConfig()
    const client = await job.client
    const content = notifyContent(event, job.plan)
    if (!vapid || !client || !content) return null
    if (!(await passGate(client, job.plan.scope, event.id))) return null

    const audience = await client.rpc("push_audience", {
      p_user_ids: job.plan.userIds,
      p_exclude: event.actor?.userId ?? null,
    })
    if (audience.error) {
      schemaMissing(audience.error)
      return null
    }
    const rows = (audience.data ?? []) as AudienceRow[]
    if (rows.length === 0) return { sent: 0, gone: 0, failed: 0 }

    const { default: webpush } = await import("web-push")
    const payload = JSON.stringify(pushPayload(event, job.plan, content))
    const options = {
      vapidDetails: vapid,
      TTL: job.plan.ttlSeconds,
      urgency: job.plan.urgent ? ("high" as const) : ("normal" as const),
      topic: topicOf(job.plan.tag),
      timeout: SEND_TIMEOUT_MS,
    }
    const results = await Promise.allSettled(
      rows.map((row) => webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, options))
    )

    const gone: string[] = []
    const failed: string[] = []
    results.forEach((result, i) => {
      if (result.status === "fulfilled") return
      const status = statusOf(result.reason)
      if (status === 404 || status === 410) gone.push(rows[i].endpoint)
      // 429: the push service is throttling us, not a broken device.
      else if (status !== 429) failed.push(rows[i].endpoint)
    })
    if (gone.length > 0 || failed.length > 0) {
      await client.rpc("push_report", { p_gone: gone, p_failed: failed })
    }
    const sent = results.filter((result) => result.status === "fulfilled").length
    return { sent, gone: gone.length, failed: failed.length }
  } catch {
    return null
  }
}
