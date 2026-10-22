"use client"

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { withSeason, type SeasonKey } from "@/components/pages/use-season"
import type {
  ArchiveDetailResponse,
  ArchivesResponse,
  ChampionsResponse,
  DuosResponse,
  GameDetailResponse,
  HistoryResponse,
  LeaderboardResponse,
  PlayerDetailResponse,
  PointsHistoryResponse,
  RivalriesResponse,
  RivalryDetailResponse,
  StatsResponse,
} from "@/lib/pages/types"

export class PageApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
}

export async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" })
  const body = (await res.json().catch(() => null)) as { error?: string } | null
  if (!res.ok) throw new PageApiError(body?.error ?? "The court is not answering. Try again.", res.status)
  return body as T
}

// Client errors (bad id, signed out) will not fix themselves: retry only what might.
const retryTransient = (count: number, error: Error) =>
  count < 2 && !(error instanceof PageApiError && error.status >= 400 && error.status < 500)

// Every stats key carries its season right after the live root, so one invalidation of "games" refreshes them all.
export const PAGE_KEYS = {
  leaderboard: ["leaderboard"] as const,
  treasury: (season: SeasonKey = "current") => ["leaderboard", season] as const,
  stats: (season: SeasonKey = "current") => ["games", "stats", season] as const,
  champions: (season: SeasonKey = "current") => ["games", "champions", season] as const,
  duos: (season: SeasonKey = "current") => ["games", "duos", season] as const,
  rivalries: (season: SeasonKey = "current") => ["games", "rivalries", season] as const,
  rivalry: (a: string, b: string, season: SeasonKey = "current") => ["games", "rivalries", season, a, b] as const,
  history: (playerId: string | null, season: SeasonKey = "current") => ["games", "history", season, playerId ?? "all"] as const,
  player: (playerId: string, season: SeasonKey = "current") => ["games", "player", season, playerId] as const,
  game: (gameId: string) => ["games", "game", gameId] as const,
  pointsHistory: (userId: string | null) => ["points", userId ?? "anonymous", "history"] as const,
  archives: ["acts", "list"] as const,
  archive: (id: number) => ["acts", id, "archive"] as const,
}

export function useLeaderboard(season: SeasonKey = "current") {
  return useQuery({
    queryKey: PAGE_KEYS.treasury(season),
    queryFn: ({ signal }) => fetchJson<LeaderboardResponse>(withSeason("/api/leaderboard", season), signal),
    staleTime: 10_000,
    retry: retryTransient,
  })
}

export function useStats(season: SeasonKey = "current") {
  return useQuery({
    queryKey: PAGE_KEYS.stats(season),
    queryFn: ({ signal }) => fetchJson<StatsResponse>(withSeason("/api/stats", season), signal),
    staleTime: 30_000,
    retry: retryTransient,
  })
}

export function useChampionStats(season: SeasonKey = "current") {
  return useQuery({
    queryKey: PAGE_KEYS.champions(season),
    queryFn: ({ signal }) => fetchJson<ChampionsResponse>(withSeason("/api/stats/champions", season), signal),
    staleTime: 60_000,
    retry: retryTransient,
  })
}

export function useDuos(season: SeasonKey = "current") {
  return useQuery({
    queryKey: PAGE_KEYS.duos(season),
    queryFn: ({ signal }) => fetchJson<DuosResponse>(withSeason("/api/duos", season), signal),
    staleTime: 30_000,
    retry: retryTransient,
  })
}

export function useRivalries(season: SeasonKey = "current") {
  return useQuery({
    queryKey: PAGE_KEYS.rivalries(season),
    queryFn: ({ signal }) => fetchJson<RivalriesResponse>(withSeason("/api/rivalries", season), signal),
    staleTime: 30_000,
    retry: retryTransient,
  })
}

export function useRivalryDetail(a: string | null, b: string | null, season: SeasonKey = "current") {
  return useQuery({
    queryKey: PAGE_KEYS.rivalry(a ?? "none", b ?? "none", season),
    queryFn: ({ signal }) => fetchJson<RivalryDetailResponse>(withSeason(`/api/rivalries/${a}/${b}`, season), signal),
    enabled: !!a && !!b,
    staleTime: 30_000,
    retry: retryTransient,
  })
}

export function usePlayerDetail(playerId: string | null, season: SeasonKey = "current") {
  return useQuery({
    queryKey: PAGE_KEYS.player(playerId ?? "none", season),
    queryFn: ({ signal }) => fetchJson<PlayerDetailResponse>(withSeason(`/api/stats/players/${playerId}`, season), signal),
    enabled: !!playerId,
    staleTime: 30_000,
    retry: retryTransient,
  })
}

// A single game, whatever act it belongs to: the match sheet and links to /history?game=<id>.
export function useGameDetail(gameId: string | null) {
  return useQuery({
    queryKey: PAGE_KEYS.game(gameId ?? "none"),
    queryFn: ({ signal }) => fetchJson<GameDetailResponse>(`/api/games/${gameId}`, signal),
    enabled: !!gameId,
    staleTime: 60_000,
    retry: retryTransient,
  })
}

export function useHistory(playerId: string | null, season: SeasonKey = "current") {
  return useInfiniteQuery({
    queryKey: PAGE_KEYS.history(playerId, season),
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: "15" })
      if (pageParam) params.set("cursor", pageParam)
      if (playerId) params.set("player", playerId)
      return fetchJson<HistoryResponse>(withSeason("/api/games", season, params), signal)
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: retryTransient,
  })
}

export function usePointsHistory(userId: string | null) {
  return useQuery({
    queryKey: PAGE_KEYS.pointsHistory(userId),
    queryFn: ({ signal }) => fetchJson<PointsHistoryResponse>("/api/points/history", signal),
    enabled: !!userId,
    staleTime: 15_000,
    retry: retryTransient,
  })
}

export function useArchives() {
  return useQuery({
    queryKey: PAGE_KEYS.archives,
    queryFn: ({ signal }) => fetchJson<ArchivesResponse>("/api/archives", signal),
    staleTime: 5 * 60_000,
    retry: retryTransient,
  })
}

export function useArchive(id: number | null) {
  return useQuery({
    queryKey: PAGE_KEYS.archive(id ?? 0),
    queryFn: ({ signal }) => fetchJson<ArchiveDetailResponse>(`/api/archives/${id}`, signal),
    enabled: id !== null && id > 0,
    staleTime: 5 * 60_000,
    retry: retryTransient,
  })
}
