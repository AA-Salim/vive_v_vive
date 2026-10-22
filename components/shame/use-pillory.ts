"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { pointsKey } from "@/hooks/use-points"
import { PILLORY_RULES } from "@/lib/bounties/rules"
import type {
  PilloryPostInput,
  PilloryPostResult,
  PilloryPreview,
  PilloryWall,
  RosterPlayer,
  EggResult,
} from "@/lib/bounties/types"
import { getJson, postJson, setCachedBalance } from "@/components/bounties/request"

export const pilloryWallKey = (userId: string | null) => ["shame", "wall", userId ?? "anonymous"] as const
export const pilloryPreviewKey = (playerId: string | null) => ["shame", "preview", playerId ?? "none"] as const

export function usePilloryWall(userId: string | null) {
  return useQuery({
    queryKey: pilloryWallKey(userId),
    queryFn: ({ signal }) => getJson<PilloryWall>("/api/shame", signal, "The pillory collapsed under the weight of the shame."),
    staleTime: 15_000,
  })
}

export function usePilloryPreview(playerId: string | null) {
  return useQuery({
    queryKey: pilloryPreviewKey(playerId),
    queryFn: ({ signal }) =>
      getJson<PilloryPreview>(`/api/shame?target=${playerId}`, signal, "The scribes could not read their record."),
    enabled: !!playerId,
    staleTime: 60_000,
  })
}

export interface PostVariables extends PilloryPostInput {
  target: RosterPlayer
  stat: { label: string; value: string }
  me: { userId: string; name: string; avatarUrl: string | null }
}

export function usePostPillory(userId: string | null) {
  const queryClient = useQueryClient()
  const key = pilloryWallKey(userId)
  return useMutation({
    mutationFn: ({ targetPlayerId, message, statKey }: PostVariables) =>
      postJson<PilloryPostResult>(
        "/api/shame",
        { action: "post", targetPlayerId, message, statKey },
        "The nails bent. Nobody was pilloried, your points are safe."
      ),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PilloryWall>(key)
      if (previous) {
        const now = Date.now()
        queryClient.setQueryData<PilloryWall>(key, {
          ...previous,
          entries: [
            {
              id: `optimistic-${variables.targetPlayerId}`,
              kind: "user",
              target: variables.target,
              shamer: variables.me,
              message: variables.message,
              stat: variables.stat,
              recentLosses: [],
              createdAt: new Date(now).toISOString(),
              expiresAt: new Date(now + PILLORY_RULES.hours * 3_600_000).toISOString(),
              eggs: 0,
              thrown: false,
              cost: PILLORY_RULES.cost,
              tribunal: null,
            },
            ...previous.entries,
          ],
          viewer: { ...previous.viewer, nextPostAt: new Date(now + PILLORY_RULES.cooldownHours * 3_600_000).toISOString() },
        })
      }
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: (result) => setCachedBalance(queryClient, userId, result.balance),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["shame"] })
      if (userId) queryClient.invalidateQueries({ queryKey: pointsKey(userId) })
    },
  })
}

export function useEgg(userId: string | null) {
  const queryClient = useQueryClient()
  const key = pilloryWallKey(userId)
  return useMutation({
    mutationFn: (entryId: string) =>
      postJson<EggResult>("/api/shame", { action: "egg", entryId }, "The egg missed. Try again."),
    onMutate: async (entryId) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PilloryWall>(key)
      if (previous) {
        queryClient.setQueryData<PilloryWall>(key, {
          ...previous,
          entries: previous.entries.map((e) => (e.id === entryId ? { ...e, eggs: e.eggs + 1, thrown: true } : e)),
        })
      }
      return { previous }
    },
    onError: (_error, _entryId, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSuccess: (result) => {
      queryClient.setQueryData<PilloryWall>(key, (wall) =>
        wall
          ? {
              ...wall,
              entries: wall.entries.map((e) =>
                e.id === result.entryId ? { ...e, eggs: result.eggs, thrown: true, expiresAt: result.expiresAt } : e
              ),
            }
          : wall
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["shame", "wall"] }),
  })
}
