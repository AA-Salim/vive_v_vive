import type { SupabaseClient } from "@supabase/supabase-js"
import { queueCutoff } from "@/lib/lobby/constants"
import type { QueueEntryView } from "@/lib/lobby/types"

interface DbError {
  code?: string
  message?: string
}

interface EmbeddedPlayer {
  id: string
  name: string
  is_active: boolean
  auth_user_id: string | null
}

interface QueueRow {
  id: string
  player_id: string
  position: number
  joined_at: string
  players: EmbeddedPlayer | EmbeddedPlayer[] | null
}

export interface QueueSnapshot {
  entries: QueueEntryView[]
  staleIds: string[]
  maxPosition: number
}

const QUEUE_SELECT = "id, player_id, position, joined_at, players:player_id ( id, name, is_active, auth_user_id )"

function embedded(row: QueueRow): EmbeddedPlayer | null {
  return Array.isArray(row.players) ? (row.players[0] ?? null) : row.players
}

// Entries older than the TTL or belonging to benched players stay in the table until the next write,
// but nobody sees them and the rotation never calls them up.
export async function loadQueue(supabase: SupabaseClient): Promise<{ snapshot: QueueSnapshot; error: DbError | null }> {
  const { data, error } = await supabase
    .from("player_queue")
    .select(QUEUE_SELECT)
    .order("position", { ascending: true })
    .order("joined_at", { ascending: true })
  if (error) return { snapshot: { entries: [], staleIds: [], maxPosition: 0 }, error }

  const cutoff = Date.parse(queueCutoff())
  const entries: QueueEntryView[] = []
  const staleIds: string[] = []
  let maxPosition = 0
  for (const row of (data ?? []) as QueueRow[]) {
    maxPosition = Math.max(maxPosition, row.position)
    const player = embedded(row)
    if (!player?.is_active || Date.parse(row.joined_at) < cutoff) {
      staleIds.push(row.id)
      continue
    }
    entries.push({
      id: row.id,
      player_id: row.player_id,
      position: row.position,
      joined_at: row.joined_at,
      name: player.name,
      user_id: player.auth_user_id,
    })
  }
  return { snapshot: { entries, staleIds, maxPosition }, error: null }
}

export async function pruneQueue(supabase: SupabaseClient, snapshot: QueueSnapshot): Promise<void> {
  if (snapshot.staleIds.length === 0) return
  await supabase.from("player_queue").delete().in("id", snapshot.staleIds)
}

// Adds players at the back in the given order. Players already waiting keep their spot.
export async function appendToQueue(
  supabase: SupabaseClient,
  snapshot: QueueSnapshot,
  playerIds: string[]
): Promise<{ added: string[]; error: DbError | null }> {
  await pruneQueue(supabase, snapshot)
  const waiting = new Set(snapshot.entries.map((e) => e.player_id))
  const fresh = [...new Set(playerIds)].filter((id) => !waiting.has(id))
  if (fresh.length === 0) return { added: [], error: null }
  const rows = fresh.map((player_id, i) => ({ player_id, position: snapshot.maxPosition + 1 + i }))
  const { data, error } = await supabase
    .from("player_queue")
    .upsert(rows, { onConflict: "player_id", ignoreDuplicates: true })
    .select("player_id")
  if (error) return { added: [], error }
  return { added: ((data ?? []) as { player_id: string }[]).map((r) => r.player_id), error: null }
}

export async function removeFromQueue(supabase: SupabaseClient, playerIds: string[]): Promise<{ removed: number; error: DbError | null }> {
  if (playerIds.length === 0) return { removed: 0, error: null }
  const { data, error } = await supabase.from("player_queue").delete().in("player_id", playerIds).select("id")
  return { removed: (data ?? []).length, error }
}

export async function clearQueue(supabase: SupabaseClient): Promise<DbError | null> {
  const { error } = await supabase.from("player_queue").delete().not("id", "is", null)
  return error
}

// Rewrites positions 1..n in the requested order. Only rows whose position changes are touched.
export async function writeOrder(supabase: SupabaseClient, ordered: QueueEntryView[]): Promise<DbError | null> {
  const writes = ordered
    .map((entry, i) => ({ entry, position: i + 1 }))
    .filter(({ entry, position }) => entry.position !== position)
    .map(({ entry, position }) => supabase.from("player_queue").update({ position }).eq("id", entry.id))
  const results = await Promise.all(writes)
  return results.find((r) => r.error)?.error ?? null
}

export function moveEntry(entries: QueueEntryView[], playerId: string, to: number): QueueEntryView[] | null {
  const from = entries.findIndex((e) => e.player_id === playerId)
  if (from === -1) return null
  const next = [...entries]
  const [moved] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved)
  return next
}
