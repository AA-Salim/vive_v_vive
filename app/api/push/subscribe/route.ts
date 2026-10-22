import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { isMissingSchema } from "@/lib/db-errors"
import { vapidConfig } from "@/lib/live/server-push"

const NO_STORE = { "Cache-Control": "no-store" }

// Same allowlist as push_subscribe(): the browsers' push services only, never an arbitrary URL for the server to call.
const PUSH_SERVICE = /^https:\/\/([a-z0-9-]+\.)*(googleapis\.com|google\.com|mozilla\.com|push\.apple\.com|notify\.windows\.com)(:443)?\//

const endpointSchema = z
  .url()
  .max(2048)
  .refine((value) => PUSH_SERVICE.test(value), "Not a known push service")

const subscribeSchema = z.object({
  endpoint: endpointSchema,
  expirationTime: z.number().nullish(),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}={0,2}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{16,32}={0,2}$/),
  }),
  quiet: z.boolean().optional(),
})

const unsubscribeSchema = z.object({ endpoint: endpointSchema })

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function signedIn() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? supabase : null
}

// Registers this device for Web Push. `push: false` tells the client the server cannot send (no VAPID keys).
export async function POST(request: Request) {
  const supabase = await signedIn()
  if (!supabase) return json({ error: "Sign in with Discord to get notifications when the app is closed." }, 401)

  const parsed = subscribeSchema.safeParse(await readBody(request))
  if (!parsed.success) return json({ error: "Invalid push subscription" }, 400)
  if (!vapidConfig()) return json({ subscribed: false, push: false })

  const { endpoint, keys, quiet } = parsed.data
  const { error } = await supabase.rpc("push_subscribe", {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_quiet: quiet ?? false,
  })
  if (error) {
    if (isMissingSchema(error)) return json({ error: "Push is not available yet.", code: "migration_pending" }, 503)
    return json({ error: "Could not save this device. Try again." }, 500)
  }
  return json({ subscribed: true, push: true })
}

export async function DELETE(request: Request) {
  const supabase = await signedIn()
  if (!supabase) return json({ error: "Not signed in" }, 401)

  const parsed = unsubscribeSchema.safeParse(await readBody(request))
  if (!parsed.success) return json({ error: "Invalid push subscription" }, 400)

  const { error } = await supabase.rpc("push_unsubscribe", { p_endpoint: parsed.data.endpoint })
  if (error) {
    if (isMissingSchema(error)) return json({ unsubscribed: false, code: "migration_pending" })
    return json({ error: "Could not forget this device. Try again." }, 500)
  }
  return json({ unsubscribed: true })
}
