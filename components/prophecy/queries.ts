"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import type { Category } from "@/lib/prophecy/constants"
import { addToBook } from "@/lib/prophecy/odds"
import type { OpenTribunalResponse, ProphecyBoard, TribunalState, WagerView } from "@/lib/prophecy/types"

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message)
  }
}

type Clocked<T> = T & { clockOffset: number }

export type ClockedBoard = Clocked<ProphecyBoard>
export type ClockedTribunal = Clocked<TribunalState>
export type ClockedOpenTribunal = Clocked<OpenTribunalResponse>

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init })
  const body = (await res.json().catch(() => null)) as (T & { error?: string; code?: string }) | null
  if (!res.ok || !body) {
    throw new ApiError(body?.error ?? "The court is not answering. Try again.", res.status, body?.code)
  }
  return body
}

function post<T>(url: string, payload: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
}

function withClock<T extends { now: string }>(body: T): Clocked<T> {
  return { ...body, clockOffset: Date.now() - Date.parse(body.now) }
}

export const boardKey = (sessionId: string) => ["sidebets", "prophecies", sessionId] as const
export const tribunalKey = (sessionId: string) => ["votes", "session", sessionId] as const
export const openTribunalKey = ["votes", "open"] as const

export function useProphecyBoard(sessionId: string) {
  return useQuery({
    queryKey: boardKey(sessionId),
    queryFn: async () => withClock(await request<ProphecyBoard>(`/api/sessions/${sessionId}/prophecies`)),
    staleTime: 5_000,
  })
}

export interface SealInput {
  market: Category
  playerId: string
  stake: number
}

export function useSealProphecy(sessionId: string) {
  const queryClient = useQueryClient()
  const key = boardKey(sessionId)
  return useMutation({
    mutationFn: (input: SealInput) =>
      post<{ placed: boolean; wager: WagerView }>(`/api/sessions/${sessionId}/prophecies`, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ClockedBoard>(key)
      if (previous?.viewer) {
        const optimistic: WagerView = {
          id: "optimistic",
          userId: previous.viewer.userId,
          username: "You",
          avatarUrl: null,
          market: input.market,
          playerId: input.playerId,
          stake: input.stake,
          status: "pending",
          payout: null,
          createdAt: new Date().toISOString(),
        }
        queryClient.setQueryData<ClockedBoard>(key, {
          ...previous,
          mine: optimistic,
          wagers: [...previous.wagers, optimistic],
          books: { ...previous.books, [input.market]: addToBook(previous.books[input.market], input.playerId, input.stake) },
        })
      }
      return { previous }
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.error(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["sidebets"] })
      queryClient.invalidateQueries({ queryKey: ["points"] })
    },
  })
}

export function useTribunal(sessionId: string | null) {
  return useQuery({
    queryKey: tribunalKey(sessionId ?? "none"),
    queryFn: async () => withClock(await request<TribunalState>(`/api/sessions/${sessionId}/votes`)),
    enabled: !!sessionId,
    staleTime: 3_000,
    refetchInterval: (query) => (query.state.data?.vote?.status === "open" ? 15_000 : false),
  })
}

export interface CastInput {
  category: Category
  playerId: string
}

export function useCastVote(sessionId: string) {
  const queryClient = useQueryClient()
  const key = tribunalKey(sessionId)
  return useMutation({
    mutationFn: (input: CastInput) => post<{ ok: boolean }>(`/api/sessions/${sessionId}/votes`, input),
    onMutate: async ({ category, playerId }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ClockedTribunal>(key)
      if (previous) {
        const before = previous.mine[category]
        const tally = { ...previous.tallies[category] }
        if (before) tally[before] = Math.max(0, (tally[before] ?? 1) - 1)
        tally[playerId] = (tally[playerId] ?? 0) + 1
        queryClient.setQueryData<ClockedTribunal>(key, {
          ...previous,
          mine: { ...previous.mine, [category]: playerId },
          tallies: { ...previous.tallies, [category]: tally },
          ballots: { ...previous.ballots, [category]: previous.ballots[category] + (before ? 0 : 1) },
        })
      }
      return { previous }
    },
    onError: (error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
      toast.error(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["votes"] })
    },
  })
}

export function useOpenTribunal() {
  return useQuery({
    queryKey: openTribunalKey,
    queryFn: async () => withClock(await request<OpenTribunalResponse>("/api/votes/open")),
    staleTime: 10_000,
    refetchInterval: (query) => (query.state.data?.tribunal?.status === "open" ? 20_000 : false),
  })
}
