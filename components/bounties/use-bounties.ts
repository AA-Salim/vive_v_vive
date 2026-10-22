"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { pointsKey } from "@/hooks/use-points"
import { BOUNTY_RULES, nextEscapeBonus } from "@/lib/bounties/rules"
import type { BountyBoard, PledgeResult, RosterPlayer, WarrantView } from "@/lib/bounties/types"
import { getJson, postJson, setCachedBalance } from "@/components/bounties/request"

export const bountyBoardKey = (userId: string | null) => ["bounties", "board", userId ?? "anonymous"] as const
export const ROSTER_KEY = ["bounties", "roster"] as const

export function useBountyBoard(userId: string | null) {
  return useQuery({
    queryKey: bountyBoardKey(userId),
    queryFn: ({ signal }) => getJson<BountyBoard>("/api/bounties", signal, "The warrant board fell off the wall."),
    staleTime: 15_000,
  })
}

export function useRoster(enabled = true) {
  return useQuery({
    queryKey: ROSTER_KEY,
    queryFn: async ({ signal }) =>
      (await getJson<{ players: RosterPlayer[] }>("/api/bounties?view=roster", signal, "The court roll could not be read.")).players,
    staleTime: 5 * 60_000,
    enabled,
  })
}

export interface PledgeVariables {
  target: RosterPlayer
  amount: number
  me: { userId: string; name: string; avatarUrl: string | null }
}

function withPledge(board: BountyBoard, { target, amount, me }: PledgeVariables): BountyBoard {
  const now = new Date().toISOString()
  const existing = board.warrants.find((w) => w.kind === "warrant" && w.target.playerId === target.playerId)
  const stack = (w: WarrantView): WarrantView => {
    const mine = w.mine + amount
    const others = w.backers.filter((b) => b.userId !== me.userId)
    const pledged = w.pledged + amount
    return {
      ...w,
      pledged,
      price: w.price + amount,
      mine,
      backers: [...others, { ...me, amount: mine }].sort((a, b) => b.amount - a.amount),
      nextEscapeBonus: nextEscapeBonus(pledged, w.crownBonus),
    }
  }
  const warrants = existing
    ? board.warrants.map((w) => (w.id === existing.id ? stack(w) : w))
    : [
        ...board.warrants,
        stack({
          id: `optimistic-${target.playerId}`,
          kind: "warrant",
          target: { playerId: target.playerId, name: target.name, userId: target.userId, avatarUrl: target.avatarUrl },
          pledged: 0,
          crownBonus: 0,
          price: 0,
          escapes: 0,
          openedAt: now,
          expiresAt: new Date(Date.now() + BOUNTY_RULES.lifetimeDays * 86_400_000).toISOString(),
          backers: [],
          mine: 0,
          nextEscapeBonus: 0,
          legacyPayout: null,
        }),
      ]
  return { ...board, warrants: [...warrants].sort((a, b) => b.price - a.price) }
}

export function usePledge(userId: string | null) {
  const queryClient = useQueryClient()
  const key = bountyBoardKey(userId)
  return useMutation({
    mutationFn: ({ target, amount }: PledgeVariables) =>
      postJson<PledgeResult>(
        "/api/bounties",
        { targetPlayerId: target.playerId, amount },
        "The scribe dropped the warrant. Your points are safe, try again."
      ),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<BountyBoard>(key)
      if (previous) queryClient.setQueryData<BountyBoard>(key, withPledge(previous, variables))
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: (result) => setCachedBalance(queryClient, userId, result.balance),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["bounties"] })
      if (userId) queryClient.invalidateQueries({ queryKey: pointsKey(userId) })
    },
  })
}
