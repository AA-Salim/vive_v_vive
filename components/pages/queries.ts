"use client"

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query"
import type {
  ArchiveDetailResponse,
  ArchivesResponse,
  ChampionsResponse,
  DuosResponse,
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

export const PAGE_KEYS = {
  leaderboard: ["leaderboard"] as const,
  stats: ["games", "stats"] as const,
  champions: ["games", "champions"] as const,
  duos: ["games", "duos"] as const,
  rivalries: ["games", "rivalries"] as const,
  rivalry: (a: string, b: string) => ["games", "rivalries", a, b] as const,
  history: (playerId: string | null) => ["games", "history", playerId ?? "all"] as const,
  player: (playerId: string) => ["games", "player", playerId] as const,
  pointsHistory: (userId: string | null) => ["points", userId ?? "anonymous", "history"] as const,
  archives: ["acts", "list"] as const,
  archive: (id: number) => ["acts", id, "archive"] as const,
}

export function useLeaderboard() {
  return useQuery({
    queryKey: PAGE_KEYS.leaderboard,
    queryFn: ({ signal }) => fetchJson<LeaderboardResponse>("/api/leaderboard", signal),
    staleTime: 10_000,
    retry: retryTransient,
  })
}

export function useStats() {
  return useQuery({
    queryKey: PAGE_KEYS.stats,
    queryFn: ({ signal }) => fetchJson<StatsResponse>("/api/stats", signal),
    staleTime: 30_000,
    retry: retryTransient,
  })
}

export function useChampionStats() {
  return useQuery({
    queryKey: PAGE_KEYS.champions,
    queryFn: ({ signal }) => fetchJson<ChampionsResponse>("/api/stats/champions", signal),
    staleTime: 60_000,
    retry: retryTransient,
  })
}

export function useDuos() {
  return useQuery({
    queryKey: PAGE_KEYS.duos,
    queryFn: ({ signal }) => fetchJson<DuosResponse>("/api/duos", signal),
    staleTime: 30_000,
    retry: retryTransient,
  })
}

export function useRivalries() {
  return useQuery({
    queryKey: PAGE_KEYS.rivalries,
    queryFn: ({ signal }) => fetchJson<RivalriesResponse>("/api/rivalries", signal),
    staleTime: 30_000,
    retry: retryTransient,
  })
}

export function useRivalryDetail(a: string | null, b: string | null) {
  return useQuery({
    queryKey: PAGE_KEYS.rivalry(a ?? "none", b ?? "none"),
    queryFn: ({ signal }) => fetchJson<RivalryDetailResponse>(`/api/rivalries/${a}/${b}`, signal),
    enabled: !!a && !!b,
    staleTime: 30_000,
    retry: retryTransient,
  })
}

export function usePlayerDetail(playerId: string | null) {
  return useQuery({
    queryKey: PAGE_KEYS.player(playerId ?? "none"),
    queryFn: ({ signal }) => fetchJson<PlayerDetailResponse>(`/api/stats/players/${playerId}`, signal),
    enabled: !!playerId,
    staleTime: 30_000,
    retry: retryTransient,
  })
}

export function useHistory(playerId: string | null) {
  return useInfiniteQuery({
    queryKey: PAGE_KEYS.history(playerId),
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: "15" })
      if (pageParam) params.set("cursor", pageParam)
      if (playerId) params.set("player", playerId)
      return fetchJson<HistoryResponse>(`/api/games?${params}`, signal)
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
