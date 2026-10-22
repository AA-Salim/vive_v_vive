"use client"

import { useCallback, useEffect, useSyncExternalStore } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { currentSeason, toSeason, type ActRow } from "@/lib/pages/season-calendar"
import type { Season } from "@/lib/pages/types"

// "current" is the act being played: it stays out of the URL so plain links always follow the live act.
export type SeasonKey = "current" | "all" | number

export const SEASONS_KEY = ["acts", "seasons"] as const

// The pick follows the reader from tab to tab for the visit (session storage), and a new visit starts on the live act.
const STORAGE_KEY = "vvv-season"
const CHANGE_EVENT = "vvv-season-change"

export function parseSeason(raw: string | null | undefined): SeasonKey {
  if (raw === "all") return "all"
  return raw && /^[1-9]\d{0,2}$/.test(raw) ? Number(raw) : "current"
}

export function seasonParam(key: SeasonKey): string | null {
  return key === "current" ? null : String(key)
}

export function withSeason(path: string, key: SeasonKey, params = new URLSearchParams()): string {
  const act = seasonParam(key)
  if (act) params.set("act", act)
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

// The URL key that shows this act: the live act needs no param.
export function seasonKeyOf(season: Season | null): SeasonKey {
  if (!season) return "all"
  return season.status === "active" ? "current" : season.number
}

function readStored(): string | null {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function remember(key: SeasonKey) {
  const value = seasonParam(key)
  try {
    if (value === readStored()) return
    if (value) window.sessionStorage.setItem(STORAGE_KEY, value)
    else window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    return
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => window.removeEventListener(CHANGE_EVENT, onChange)
}

export function useSeasons() {
  return useQuery({
    queryKey: SEASONS_KEY,
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/acts/list", { signal, cache: "no-store" })
      if (!res.ok) throw new Error("The royal calendar is not answering.")
      const body = (await res.json()) as { acts?: ActRow[] }
      return (body.acts ?? []).map(toSeason).filter((s) => s.status !== "upcoming")
    },
    staleTime: 10 * 60_000,
  })
}

// What a key points at, once the calendar is known. undefined: still loading, or an act that does not exist.
export function resolveSeasonKey(key: SeasonKey, seasons: Season[] | undefined, served?: Season | null): Season | null | undefined {
  if (key === "all") return null
  if (served !== undefined && (key === "current" || served?.number === key)) return served
  if (!seasons) return undefined
  return key === "current" ? currentSeason(seasons) : seasons.find((s) => s.number === key)
}

function replaceUrl(pathname: string, key: SeasonKey) {
  const params = new URLSearchParams(window.location.search)
  params.delete("act")
  window.history.replaceState(null, "", withSeason(pathname, key, params))
}

// The season a page reads: the URL first (?act=2, ?act=all), then the pick made on another tab, then the live act.
export function useSeasonParam(): [SeasonKey, (next: SeasonKey) => void] {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const raw = searchParams.get("act")
  const stored = useSyncExternalStore(subscribe, readStored, () => null)
  const season = parseSeason(raw ?? stored)

  // Only when the URL itself changes (a shared link, a manual edit): a pick made here already remembered itself,
  // and the router hands back the new URL a render later than the storage.
  useEffect(() => {
    if (raw !== null) remember(parseSeason(raw))
  }, [raw])

  useEffect(() => {
    if (raw === null && stored !== null && parseSeason(stored) !== "current") replaceUrl(pathname, parseSeason(stored))
  }, [raw, stored, pathname])

  const setSeason = useCallback(
    (next: SeasonKey) => {
      remember(next)
      const params = new URLSearchParams(window.location.search)
      params.delete("act")
      // A game opened from a link belongs to one act: switching acts closes it.
      params.delete("game")
      window.history.replaceState(null, "", withSeason(pathname, next, params))
    },
    [pathname]
  )
  return [season, setSeason]
}
