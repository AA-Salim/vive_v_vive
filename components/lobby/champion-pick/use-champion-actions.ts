"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { sideForChampionPick, type CatalogChampion, type ChampionDraftView } from "@/lib/lobby/champion-pick"
import { championDraftKey, toBoard, type ChampionBoard } from "@/lib/lobby/champion-queries"
import { LobbyApiError, errorMessage, sendJson } from "@/lib/lobby/queries"
import { ACTIVE_SESSION_KEY } from "@/lib/live/events"

export interface PickInput {
  playerId: string
  champion: CatalogChampion
  pickNumber: number
}

export function useChampionActions(sessionId: string, userId: string | null) {
  const queryClient = useQueryClient()
  const key = championDraftKey(sessionId)
  const url = `/api/sessions/${sessionId}/coach-draft/champions`

  const begin = async (update: (board: ChampionBoard) => ChampionBoard) => {
    await queryClient.cancelQueries({ queryKey: key })
    const previous = queryClient.getQueryData<ChampionBoard>(key)
    if (previous) queryClient.setQueryData<ChampionBoard>(key, update(previous))
    return { previous }
  }
  const fail = (error: unknown, context: { previous?: ChampionBoard } | undefined) => {
    if (context?.previous) queryClient.setQueryData(key, context.previous)
    toast.error(errorMessage(error))
    if (error instanceof LobbyApiError && (error.code === "turn_expired" || error.code === "stale")) {
      queryClient.invalidateQueries({ queryKey: key })
    }
  }
  const store = (view: ChampionDraftView) => {
    queryClient.setQueryData(key, toBoard(view))
    if (!view.open) queryClient.invalidateQueries({ queryKey: ACTIVE_SESSION_KEY })
  }
  const settle = () => queryClient.invalidateQueries({ queryKey: key })

  const pick = useMutation({
    mutationKey: ["coachdraft", sessionId, "champion-pick"],
    mutationFn: (input: PickInput) =>
      sendJson<ChampionDraftView>(url, {
        action: "pick",
        player_id: input.playerId,
        champion: input.champion.name,
        pick_number: input.pickNumber,
      }),
    onMutate: (input) =>
      begin((board) => {
        const slot = board.slots.find((s) => s.player_id === input.playerId)
        const side = sideForChampionPick(input.pickNumber)
        if (!slot?.lane || !side || board.picks.length + 1 !== input.pickNumber) return board
        const pending = {
          id: `pending-${input.pickNumber}`,
          pick_number: input.pickNumber,
          side,
          player_id: input.playerId,
          lane: slot.lane,
          champion: input.champion.name,
          champion_internal: input.champion.internal,
          picked_by: userId,
          auto: false,
          requested: board.requests.some((r) => r.player_id === input.playerId && r.champion === input.champion.name),
          created_at: new Date().toISOString(),
        }
        return { ...board, picks: [...board.picks, pending], turn: null }
      }),
    onSuccess: store,
    onError: (error, _input, context) => fail(error, context),
    onSettled: settle,
  })

  const undo = useMutation({
    mutationKey: ["coachdraft", sessionId, "champion-undo"],
    mutationFn: () => sendJson<ChampionDraftView>(url, { action: "undo" }),
    onMutate: () => begin((board) => ({ ...board, picks: board.picks.slice(0, -1), turn: null })),
    onSuccess: store,
    onError: (error, _vars, context) => fail(error, context),
    onSettled: settle,
  })

  const request = useMutation({
    mutationKey: ["coachdraft", sessionId, "champion-request"],
    mutationFn: ({ champion }: { playerId: string; champion: CatalogChampion | null }) =>
      sendJson<ChampionDraftView>(url, { action: "request", champion: champion?.name ?? null }),
    onMutate: ({ playerId, champion }) =>
      begin((board) => {
        const others = board.requests.filter((r) => r.player_id !== playerId)
        const mine = champion
          ? [{ player_id: playerId, champion: champion.name, champion_internal: champion.internal, updated_at: new Date().toISOString() }]
          : []
        return { ...board, requests: [...others, ...mine] }
      }),
    onSuccess: (view, { champion }) => {
      store(view)
      toast(champion ? `${champion.name} pinned. Your coach can see it.` : "Request cleared.")
    },
    onError: (error, _vars, context) => fail(error, context),
    onSettled: settle,
  })

  return { pick, undo, request }
}
