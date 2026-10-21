"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { writeSession } from "@/components/session/use-session-actions"
import { QUEUE_KEY, VAINQUEUR_KEY, errorMessage, sendJson } from "@/lib/lobby/queries"
import type { RotationMode, VainqueurAction, VainqueurView } from "@/lib/lobby/types"
import type { RoomSession } from "@/lib/session/types"

type StateAction = Exclude<VainqueurAction, { action: "next_game" }>

function optimistic(view: VainqueurView, action: StateAction, playerId: string | null): VainqueurView {
  const id = ("player_id" in action ? action.player_id : undefined) ?? playerId
  switch (action.action) {
    case "activate":
      return { ...view, active: true }
    case "deactivate":
      return { ...view, active: false }
    case "volunteer":
      return id && !view.volunteers.includes(id) ? { ...view, volunteers: [...view.volunteers, id] } : view
    case "unvolunteer":
      return { ...view, volunteers: view.volunteers.filter((v) => v !== id) }
    case "sit_out": {
      const seat = view.winners.find((w) => w.id === id)
      return seat ? { ...view, winners: view.winners.filter((w) => w.id !== id), satOut: [...view.satOut, seat] } : view
    }
    case "return": {
      const seat = view.satOut.find((w) => w.id === id)
      return seat ? { ...view, satOut: view.satOut.filter((w) => w.id !== id), winners: [...view.winners, seat] } : view
    }
  }
}

export function useVainqueurActions(playerId: string | null, onNextGame?: () => void) {
  const queryClient = useQueryClient()

  const state = useMutation({
    mutationKey: ["vainqueur", "action"],
    mutationFn: (action: StateAction) => sendJson<VainqueurView>("/api/vainqueur", action),
    onMutate: async (action) => {
      await queryClient.cancelQueries({ queryKey: VAINQUEUR_KEY })
      const previous = queryClient.getQueryData<VainqueurView>(VAINQUEUR_KEY)
      if (previous) queryClient.setQueryData(VAINQUEUR_KEY, optimistic(previous, action, playerId))
      return { previous }
    },
    onSuccess: (view, action) => {
      queryClient.setQueryData(VAINQUEUR_KEY, view)
      if (action.action === "activate") toast("Winner stays is on. Winners keep their seats.")
      if (action.action === "deactivate") toast("Winner stays is off. Back to open rolls.")
    },
    onError: (error, _action, context) => {
      if (context?.previous) queryClient.setQueryData(VAINQUEUR_KEY, context.previous)
      toast.error(errorMessage(error))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: VAINQUEUR_KEY })
      queryClient.invalidateQueries({ queryKey: QUEUE_KEY })
    },
  })

  const rotate = useMutation({
    mutationKey: ["vainqueur", "rotate"],
    mutationFn: (mode: RotationMode) => sendJson<RoomSession>("/api/vainqueur", { action: "next_game", mode }),
    onSuccess: async (session) => {
      await writeSession(queryClient, session)
      toast("The rotation turned. Fate is dealing the next game.")
      onNextGame?.()
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: VAINQUEUR_KEY })
      queryClient.invalidateQueries({ queryKey: QUEUE_KEY })
      queryClient.invalidateQueries({ queryKey: ["session"] })
    },
  })

  return { state, rotate }
}
