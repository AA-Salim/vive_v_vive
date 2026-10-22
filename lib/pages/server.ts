import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getChampionPools } from "@/lib/champions-db"
import { buildChampionIndex, type ChampionLookup } from "@/lib/pages/champion-index"
import { loadMatchData, type MatchData } from "@/lib/pages/matches"
import { ALL_TIME, type PlayedWindow } from "@/lib/pages/season-calendar"
import type { PoolChampion } from "@/lib/pages/types"
import type { Role } from "@/lib/types"

export interface MatchContext {
  data: MatchData
  internalOf: ChampionLookup
  pools: Record<Role, PoolChampion[]>
}

const POOLS_TTL_MS = 10 * 60_000
let poolsCache: { at: number; pools: Promise<Record<Role, PoolChampion[]>> } | null = null

// Pools only change when an admin syncs champions; they only feed portraits here, so a warm copy is fine.
export function loadPools(): Promise<Record<Role, PoolChampion[]>> {
  if (!poolsCache || Date.now() - poolsCache.at > POOLS_TTL_MS) {
    const pools = getChampionPools()
    poolsCache = { at: Date.now(), pools }
    pools.catch(() => {
      if (poolsCache?.pools === pools) poolsCache = null
    })
  }
  return poolsCache.pools
}

export async function loadMatchContext(supabase: SupabaseClient, window: PlayedWindow = ALL_TIME): Promise<MatchContext> {
  const [data, pools] = await Promise.all([loadMatchData(supabase, window), loadPools()])
  return { data, internalOf: buildChampionIndex(pools), pools }
}

export function scribeError(message = "The royal scribes dropped the scrolls. Try again in a moment.", status = 500) {
  return NextResponse.json({ error: message }, { status })
}

// Live pages refetch on every event, so a cached copy would only ever be stale.
export function json<T>(body: T) {
  return NextResponse.json(body, { headers: { "Cache-Control": "private, no-store" } })
}
