"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { writeSession } from "@/components/session/use-session-actions"
import { sideForPick } from "@/lib/lobby/constants"
import { coachDraftKey, errorMessage, sendJson } from "@/lib/lobby/queries"
import type { CoachDraftPickView } from "@/lib/lobby/types"
import type { RoomSession } from "@/lib/session/types"
import type { Role } from "@/lib/types"

type Picks = CoachDraftPickView[]

function swapLane(picks: Picks, playerId: string, lane: Role): Picks {
  const target = picks.find((p) => p.player_id === playerId)
  if (!target) return picks
  const holder = picks.find((p) => p.side === target.side && p.lane === lane && p.player_id !== playerId)
  return picks.map((p) => (p.player_id === playerId ? { ...p, lane } : holder && p.id === holder.id ? { ...p, lane: target.lane } : p))
}

export function useCoachDraftActions(sessionId: string) {
  const queryClient = useQueryClient()
  const key = coachDraftKey(sessionId)
  const url = `/api/sessions/${sessionId}/coach-draft`

  const begin = async (update: (picks: Picks) => Picks) => {
    await queryClient.cancelQueries({ queryKey: key })
    const previous = queryClient.getQueryData<Picks>(key)
    if (previous) queryClient.setQueryData<Picks>(key, update(previous))
    return { previous }
  }
  const fail = (error: unknown, context: { previous?: Picks } | undefined) => {
    if (context?.previous) queryClient.setQueryData(key, context.previous)
    toast.error(errorMessage(error))
  }
  const settle = () => queryClient.invalidateQueries({ queryKey: key })
  const store = (picks: Picks) => queryClient.setQueryData(key, picks)

  const pick = useMutation({
    mutationKey: ["coachdraft", sessionId, "pick"],
    mutationFn: (player: { id: string; name: string }) => sendJson<Picks>(url, { action: "pick", player_id: player.id }),
    onMutate: (player) =>
      begin((picks) => {
        const pickNumber = picks.length + 1
        const side = sideForPick(pickNumber)
        if (!side || picks.some((p) => p.player_id === player.id)) return picks
        return [
          ...picks,
          {
            id: `pending-${player.id}`,
            session_id: sessionId,
            pick_number: pickNumber,
            player_id: player.id,
            side,
            lane: null,
            created_at: new Date().toISOString(),
            players: { id: player.id, name: player.name },
          },
        ]
      }),
    onSuccess: store,
    onError: (error, _player, context) => fail(error, context),
    onSettled: settle,
  })

  const undo = useMutation({
    mutationKey: ["coachdraft", sessionId, "undo"],
    mutationFn: () => sendJson<Picks>(url, { action: "undo" }),
    onMutate: () => begin((picks) => picks.slice(0, -1)),
    onSuccess: store,
    onError: (error, _vars, context) => fail(error, context),
    onSettled: settle,
  })

  const lane = useMutation({
    mutationKey: ["coachdraft", sessionId, "lane"],
    mutationFn: ({ playerId, lane }: { playerId: string; lane: Role }) =>
      sendJson<Picks>(url, { action: "assign_lane", player_id: playerId, lane }),
    onMutate: ({ playerId, lane }) => begin((picks) => swapLane(picks, playerId, lane)),
    onSuccess: store,
    onError: (error, _vars, context) => fail(error, context),
    onSettled: settle,
  })

  const autoLanes = useMutation({
    mutationKey: ["coachdraft", sessionId, "auto"],
    mutationFn: () => sendJson<Picks>(url, { action: "auto_lanes" }),
    onSuccess: store,
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: settle,
  })

  const confirm = useMutation({
    mutationKey: ["coachdraft", sessionId, "confirm"],
    mutationFn: () => sendJson<RoomSession>(url, { action: "confirm" }),
    onSuccess: async (session) => {
      await writeSession(queryClient, session)
      toast("Teams locked. Fate deals the champions.")
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => {
      settle()
      queryClient.invalidateQueries({ queryKey: ["session"] })
    },
  })

  return { pick, undo, lane, autoLanes, confirm }
}
