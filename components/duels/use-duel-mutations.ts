"use client"

import { useMemo } from "react"
import { useMutation, useMutationState, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { duelBoardKey, post, type ClockedBoard } from "@/components/duels/use-duels"
import { pointsKey } from "@/hooks/use-points"
import { actionToast } from "@/lib/duels/copy"
import type { CreateDuelInput, DuelAction, DuelMutationResult, DuelView, Duelist } from "@/lib/duels/types"
import type { SessionStatus } from "@/lib/types"

type PointsCache = { balance: number } | undefined

function shiftBalance(queryClient: QueryClient, userId: string, delta: number) {
  if (delta === 0) return
  queryClient.setQueryData<PointsCache>(pointsKey(userId), (old) => (old ? { ...old, balance: old.balance + delta } : old))
}

function setBalance(queryClient: QueryClient, userId: string, balance: number | null) {
  if (balance === null) return
  queryClient.setQueryData<PointsCache>(pointsKey(userId), (old) => (old ? { ...old, balance } : old))
}

function patchDuels(queryClient: QueryClient, key: readonly unknown[], update: (duels: DuelView[]) => DuelView[]) {
  queryClient.setQueryData<ClockedBoard>(key, (board) => (board ? { ...board, duels: update(board.duels) } : board))
}

// The whole points root: other purse views (the betting slip, the nav badge) key their balance differently.
function settle(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["duels"] })
  queryClient.invalidateQueries({ queryKey: ["points"] })
}

export interface CreateDuelVariables extends CreateDuelInput {
  challenger: Duelist
  opponent: Duelist | null
}

// Rollbacks only undo the mutation's own optimistic row and purse delta, so overlapping actions never erase
// each other; the settle refetch then brings the board back to the truth.
export function useCreateDuel(sessionId: string, status: SessionStatus, userId: string) {
  const queryClient = useQueryClient()
  const key = duelBoardKey(sessionId, status)
  return useMutation({
    mutationFn: (input: CreateDuelVariables) =>
      post<DuelMutationResult>("/api/duels", {
        sessionId,
        side: input.side,
        stake: input.stake,
        opponentId: input.opponentId,
      }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: key })
      const optimistic: DuelView = {
        id: `optimistic-${crypto.randomUUID()}`,
        sessionId,
        status: "open",
        isOpen: input.opponentId === null,
        stake: input.stake,
        challengerSide: input.side,
        challenger: input.challenger,
        opponent: input.opponent,
        winnerId: null,
        winnerSide: null,
        payout: null,
        tax: 0,
        createdAt: new Date().toISOString(),
        respondedAt: null,
        settledAt: null,
      }
      patchDuels(queryClient, key, (duels) => [...duels, optimistic])
      shiftBalance(queryClient, userId, -input.stake)
      return { optimisticId: optimistic.id, delta: -input.stake }
    },
    onError: (error, _input, context) => {
      if (context) {
        patchDuels(queryClient, key, (duels) => duels.filter((d) => d.id !== context.optimisticId))
        shiftBalance(queryClient, userId, -context.delta)
      }
      toast.error(error.message)
    },
    onSuccess: (result, _input, context) => {
      patchDuels(queryClient, key, (duels) => [
        ...duels.filter((d) => d.id !== context?.optimisticId && d.id !== result.duel.id),
        result.duel,
      ])
      setBalance(queryClient, userId, result.balance)
    },
    onSettled: () => settle(queryClient),
  })
}

export interface DuelActionVariables {
  duel: DuelView
  action: DuelAction
  me: Duelist
}

const duelActionKey = (sessionId: string) => ["duels", "action", sessionId] as const

function applyAction(duel: DuelView, action: DuelAction, me: Duelist): DuelView {
  const now = new Date().toISOString()
  if (action === "accept") return { ...duel, status: "accepted", opponent: duel.opponent ?? me, respondedAt: now }
  return { ...duel, status: action === "decline" ? "declined" : "withdrawn", respondedAt: now, settledAt: now }
}

function purseDelta(duel: DuelView, action: DuelAction): number {
  if (action === "accept") return -duel.stake
  if (action === "withdraw") return duel.stake
  return 0
}

export function useDuelAction(sessionId: string, status: SessionStatus, userId: string) {
  const queryClient = useQueryClient()
  const key = duelBoardKey(sessionId, status)
  return useMutation({
    mutationKey: duelActionKey(sessionId),
    mutationFn: ({ duel, action }: DuelActionVariables) =>
      post<DuelMutationResult>(`/api/duels/${encodeURIComponent(duel.id)}`, { action }),
    onMutate: async ({ duel, action, me }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const before = queryClient.getQueryData<ClockedBoard>(key)?.duels.find((d) => d.id === duel.id) ?? null
      patchDuels(queryClient, key, (duels) => duels.map((d) => (d.id === duel.id ? applyAction(d, action, me) : d)))
      const delta = purseDelta(duel, action)
      shiftBalance(queryClient, userId, delta)
      return { before, delta }
    },
    onError: (error, { duel }, context) => {
      const before = context?.before
      if (before) patchDuels(queryClient, key, (duels) => duels.map((d) => (d.id === duel.id ? before : d)))
      if (context) shiftBalance(queryClient, userId, -context.delta)
      toast.error(error.message)
    },
    onSuccess: (result, { duel, action }) => {
      patchDuels(queryClient, key, (duels) => duels.map((d) => (d.id === result.duel.id ? result.duel : d)))
      setBalance(queryClient, userId, result.balance)
      const line = actionToast(duel, action)
      if (action === "accept") toast.success(line.title, { description: line.description })
      else toast(line.title, { description: line.description })
    },
    onSettled: () => settle(queryClient),
  })
}

// Every action in flight for this game, so each card shows its own spinner even when several overlap.
export function usePendingDuelActions(sessionId: string): ReadonlyMap<string, DuelAction> {
  const pending = useMutationState({
    filters: { mutationKey: duelActionKey(sessionId), status: "pending" },
    select: (mutation) => mutation.state.variables as DuelActionVariables | undefined,
  })
  return useMemo(
    () => new Map(pending.filter((v): v is DuelActionVariables => !!v).map((v) => [v.duel.id, v.action] as const)),
    [pending]
  )
}
