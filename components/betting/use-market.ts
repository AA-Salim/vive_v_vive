"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BET_RULES } from "@/lib/betting/rules"
import { multiplier } from "@/lib/betting/math"
import type {
  InsureBetResult,
  MarketBet,
  MarketSnapshot,
  PlaceBetInput,
  PlaceBetResult,
  RulesVersion,
} from "@/lib/betting/types"

export interface Market extends MarketSnapshot {
  serverTimeDelta: number
}

export class BetRequestError extends Error {
  constructor(message: string, readonly status: number, readonly code: string | null) {
    super(message)
  }
}

export const marketKey = (sessionId: string) => ["bets", sessionId] as const
export const bettingBalanceKey = (userId: string | null) => ["points", "balance", "betting", userId] as const

async function fetchMarket(sessionId: string): Promise<Market> {
  const res = await fetch(`/api/sessions/${sessionId}/bets`, { cache: "no-store" })
  if (!res.ok) throw new BetRequestError("The bookmaker lost his notebook.", res.status, null)
  const serverTime = res.headers.get("x-server-time")
  const data = (await res.json()) as MarketSnapshot
  return { ...data, serverTimeDelta: serverTime ? Date.now() - new Date(serverTime).getTime() : 0 }
}

async function send<T>(url: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new BetRequestError(
      typeof data.error === "string" ? data.error : "The bookmaker spilled his ink. Try again.",
      res.status,
      typeof data.code === "string" ? data.code : null
    )
  }
  return data as T
}

export function useMarket(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: marketKey(sessionId ?? "none"),
    queryFn: () => fetchMarket(sessionId as string),
    enabled: enabled && !!sessionId,
    staleTime: 3_000,
    refetchInterval: (query) => (query.state.data?.session?.status === "betting" ? 15_000 : false),
  })
}

export function useBettingBalance(userId: string | null) {
  return useQuery({
    queryKey: bettingBalanceKey(userId),
    queryFn: async (): Promise<number> => {
      const res = await fetch("/api/points", { cache: "no-store" })
      if (!res.ok) throw new BetRequestError("Could not read your purse.", res.status, null)
      const data = (await res.json()) as { balance?: number }
      return typeof data.balance === "number" ? data.balance : 0
    },
    enabled: !!userId,
    staleTime: 5_000,
  })
}

function withOptimisticBet(market: Market, userId: string, input: PlaceBetInput, stake: number): Market {
  const existing = market.user_bet
  const now = new Date().toISOString()
  const bet: MarketBet = existing
    ? { ...existing, amount: existing.amount + stake, raises: existing.raises + 1, raised_at: now, all_in: existing.all_in || input.allIn }
    : {
        id: `optimistic-${userId}`,
        session_id: market.session?.id ?? "",
        user_id: userId,
        side: input.side,
        amount: stake,
        payout: null,
        status: "pending",
        insured: input.insure,
        created_at: now,
        scheme: input.rules === 2 ? "v2" : "legacy",
        premium: 0,
        coverage_pct: 0,
        early_amount: 0,
        all_in: input.allIn,
        bonus: 0,
        raises: 0,
        raised_at: null,
        discord_username: "You",
        discord_avatar_url: null,
        name: "You",
        net: null,
        whale: false,
      }
  bet.whale = bet.amount >= BET_RULES.whaleAmount
  const blue = market.blue_total + (input.side === "blue" ? stake : 0)
  const red = market.red_total + (input.side === "red" ? stake : 0)
  const total = blue + red
  const others = market.bets.filter((b) => b.user_id !== userId)
  return {
    ...market,
    blue_total: blue,
    red_total: red,
    total,
    blue_multiplier: multiplier(total, blue),
    red_multiplier: multiplier(total, red),
    bet_count: others.length + 1,
    blue_count: others.filter((b) => b.side === "blue").length + (bet.side === "blue" ? 1 : 0),
    red_count: others.filter((b) => b.side === "red").length + (bet.side === "red" ? 1 : 0),
    user_bet: bet,
    bets: [bet, ...others],
    entries: [bet, ...(market.entries ?? []).filter((b) => b.user_id !== userId)],
  }
}

export function usePlaceBet(sessionId: string, userId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PlaceBetInput) =>
      send<PlaceBetResult>(`/api/sessions/${sessionId}/bets`, "POST", {
        side: input.side,
        amount: input.amount,
        insure: input.insure,
        all_in: input.allIn,
        rules: input.rules,
      }),
    onMutate: async (input) => {
      if (!userId) return { previous: undefined }
      await queryClient.cancelQueries({ queryKey: marketKey(sessionId) })
      const previous = queryClient.getQueryData<Market>(marketKey(sessionId))
      if (previous) queryClient.setQueryData(marketKey(sessionId), withOptimisticBet(previous, userId, input, input.amount))
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(marketKey(sessionId), context.previous)
    },
    onSuccess: (result) => {
      if (typeof result.balance === "number") queryClient.setQueryData(bettingBalanceKey(userId), result.balance)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: marketKey(sessionId) })
      queryClient.invalidateQueries({ queryKey: ["points"] })
    },
  })
}

export function useInsureBet(sessionId: string, userId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (rules: RulesVersion) => send<InsureBetResult>(`/api/sessions/${sessionId}/bets`, "PATCH", { rules }),
    onSuccess: (result) => {
      if (typeof result.balance === "number") queryClient.setQueryData(bettingBalanceKey(userId), result.balance)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: marketKey(sessionId) })
      queryClient.invalidateQueries({ queryKey: ["points"] })
    },
  })
}
