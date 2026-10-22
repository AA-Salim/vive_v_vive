import { after } from "next/server"
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js"
import { createClient as createRequestClient } from "@/lib/supabase"
import {
  LIVE_BROADCAST_EVENT,
  LIVE_TOPIC,
  isPersistedType,
  type LiveActor,
  type LiveEvent,
  type LiveEventPayloads,
  type LiveEventType,
} from "@/lib/live/events"
import { deliverPush, preparePush } from "@/lib/live/server-push"

let channel: RealtimeChannel | null = null

function liveChannel(): RealtimeChannel {
  if (!channel) {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )
    channel = client.channel(LIVE_TOPIC)
  }
  return channel
}

interface EmitInit<T extends LiveEventType> {
  sessionId?: string | null
  actor?: LiveActor | null
  data: LiveEventPayloads[T]
  // History persistence: omitted = persist unless the type is ephemeral, using the request's signed-in client;
  // false = never; true = always; a client = persist with that client.
  persist?: boolean | SupabaseClient
}

// Writes one event to the activity history. Never throws: a missing migration or a rejected row only
// means late joiners will not see it.
export async function recordLive(client: SupabaseClient, event: LiveEvent): Promise<boolean> {
  try {
    const { error } = await client.rpc("record_activity_event", {
      p_id: event.id,
      p_type: event.type,
      p_session_id: event.sessionId,
      p_actor: event.actor,
      p_data: event.data,
    })
    return !error
  } catch {
    return false
  }
}

async function broadcastLive(event: LiveEvent): Promise<boolean> {
  try {
    const result = await liveChannel().httpSend(LIVE_BROADCAST_EVENT, event)
    return result.success
  } catch {
    // Clients fall back to postgres_changes, the persisted history and polling.
    return false
  }
}

function historyClient(
  persist: EmitInit<LiveEventType>["persist"],
  type: LiveEventType,
  callerClient: () => Promise<SupabaseClient | null>
): Promise<SupabaseClient | null> | null {
  if (persist === false) return null
  if (persist && typeof persist === "object") return Promise.resolve(persist)
  if (persist !== true && !isPersistedType(type)) return null
  return callerClient()
}

// Fire-and-forget broadcast to every connected client, sent after the response is flushed, plus a
// best-effort write to the activity history and, for major events, a Web Push to devices with the app closed.
// Must be called inside a route handler or server action.
export function emitLive<T extends LiveEventType>(type: T, init: EmitInit<T>): void {
  const event: LiveEvent<T> = {
    id: crypto.randomUUID(),
    type,
    at: new Date().toISOString(),
    sessionId: init.sessionId ?? null,
    actor: init.actor ?? null,
    data: init.data,
  }
  // Resolved now, while the request scope is guaranteed: the client reads the caller's auth cookies.
  let caller: Promise<SupabaseClient | null> | null = null
  const callerClient = () => (caller ??= createRequestClient().catch(() => null))
  const history = historyClient(init.persist, type, callerClient)
  const push = preparePush(event, callerClient)
  after(async () => {
    const persisted = history?.then((client) => (client ? recordLive(client, event) : false))
    await Promise.all([broadcastLive(event), persisted, push ? deliverPush(event, push) : null])
  })
}

export async function getActor(supabase: SupabaseClient, userId: string | null | undefined): Promise<LiveActor | null> {
  if (!userId) return null
  const { data } = await supabase
    .from("user_profiles")
    .select("discord_username, discord_avatar_url, players:player_id ( name )")
    .eq("id", userId)
    .maybeSingle()
  if (!data) return { userId, name: "Someone" }
  const player = data.players as { name?: string } | { name?: string }[] | null
  const playerName = Array.isArray(player) ? player[0]?.name : player?.name
  return {
    userId,
    name: playerName || data.discord_username || "Someone",
    avatarUrl: data.discord_avatar_url ?? null,
  }
}
