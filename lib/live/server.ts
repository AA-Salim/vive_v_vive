import { after } from "next/server"
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js"
import {
  LIVE_BROADCAST_EVENT,
  LIVE_TOPIC,
  type LiveActor,
  type LiveEvent,
  type LiveEventPayloads,
  type LiveEventType,
} from "@/lib/live/events"

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
}

// Fire-and-forget broadcast to every connected client, sent after the response is flushed.
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
  after(async () => {
    try {
      await liveChannel().httpSend(LIVE_BROADCAST_EVENT, event)
    } catch {
      // Clients fall back to postgres_changes and polling.
    }
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
