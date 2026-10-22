import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { QueryError } from "@/lib/pages/fetch-all"
import { currentSeason, toSeason, windowOf, type ActRow, type PlayedWindow } from "@/lib/pages/season-calendar"
import type { Season } from "@/lib/pages/types"

export { ALL_TIME, currentSeason, seasonOfGame, windowOf, type PlayedWindow } from "@/lib/pages/season-calendar"

// "?act=all" or an act number ("?act=2"); a missing param means the act being played right now.
export const SeasonParam = z
  .union([z.literal("all"), z.string().regex(/^[1-9]\d{0,2}$/).transform(Number)])
  .optional()

export type SeasonChoice = z.infer<typeof SeasonParam>

const ACTS_TTL_MS = 20_000
let actsCache: { at: number; acts: Promise<Season[]> } | null = null

// The acts table changes once a season: a short-lived copy saves a round trip on every stats request.
export function loadSeasons(supabase: SupabaseClient): Promise<Season[]> {
  if (!actsCache || Date.now() - actsCache.at > ACTS_TTL_MS) {
    const acts = Promise.resolve(
      supabase.from("acts").select("id, act_number, name, subtitle, status, started_at, ended_at").order("act_number")
    ).then(({ data, error }) => {
      if (error) throw new QueryError(error)
      return ((data ?? []) as ActRow[]).map(toSeason)
    })
    actsCache = { at: Date.now(), acts }
    acts.catch(() => {
      if (actsCache?.acts === acts) actsCache = null
    })
  }
  return actsCache.acts
}

// undefined: the act number does not exist. null: all time.
export function pickSeason(seasons: Season[], choice: SeasonChoice): Season | null | undefined {
  if (choice === "all") return null
  if (choice === undefined) return currentSeason(seasons)
  return seasons.find((s) => s.number === choice && s.status !== "upcoming")
}

type Filterable<Q> = { gte(column: string, value: string): Q; lt(column: string, value: string): Q }

// Applies the window to a PostgREST query; column can point into an embedded resource ("game.played_at").
export function withinWindow<Q extends Filterable<Q>>(query: Q, window: PlayedWindow, column = "played_at"): Q {
  let filtered = query
  if (window.from) filtered = filtered.gte(column, window.from)
  if (window.to) filtered = filtered.lt(column, window.to)
  return filtered
}

export type SeasonResult = { season: Season | null; window: PlayedWindow } | { error: NextResponse }

export async function resolveSeason(supabase: SupabaseClient, choice: SeasonChoice): Promise<SeasonResult> {
  const season = pickSeason(await loadSeasons(supabase), choice)
  if (season === undefined) return { error: seasonError("That act has not been written yet.", 404) }
  return { season, window: windowOf(season) }
}

export async function seasonFromRequest(supabase: SupabaseClient, request: Request): Promise<SeasonResult> {
  const raw = new URL(request.url).searchParams.get("act")
  const parsed = SeasonParam.safeParse(raw || undefined)
  if (!parsed.success) return { error: seasonError("That season is not in the royal calendar.", 400) }
  return resolveSeason(supabase, parsed.data)
}

function seasonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}
