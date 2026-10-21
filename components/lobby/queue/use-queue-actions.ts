"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { QUEUE_KEY, VAINQUEUR_KEY, errorMessage, sendJson } from "@/lib/lobby/queries"
import type { QueueAction, QueueEntryView } from "@/lib/lobby/types"

interface Me {
  playerId: string
  name: string
  userId: string | null
}

function reorder(entries: QueueEntryView[], playerId: string, to: number): QueueEntryView[] {
  const from = entries.findIndex((e) => e.player_id === playerId)
  if (from === -1) return entries
  const next = [...entries]
  const [moved] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved)
  return next
}

function optimistic(entries: QueueEntryView[], action: QueueAction, me: Me | null): QueueEntryView[] {
  switch (action.action) {
    case "join": {
      if (!me || action.player_id || entries.some((e) => e.player_id === me.playerId)) return entries
      const position = Math.max(0, ...entries.map((e) => e.position)) + 1
      return [
        ...entries,
        { id: `pending-${me.playerId}`, player_id: me.playerId, position, joined_at: new Date().toISOString(), name: me.name, user_id: me.userId },
      ]
    }
    case "leave": {
      const target = action.player_id ?? me?.playerId
      return entries.filter((e) => e.player_id !== target)
    }
    case "move":
      return reorder(entries, action.player_id, action.to)
    case "clear":
      return []
  }
}

export function useQueueActions(me: Me | null, onDone?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ["queue", "action"],
    mutationFn: (action: QueueAction) => sendJson<QueueEntryView[]>("/api/queue", action),
    onMutate: async (action) => {
      await queryClient.cancelQueries({ queryKey: QUEUE_KEY })
      const previous = queryClient.getQueryData<QueueEntryView[]>(QUEUE_KEY)
      if (previous) queryClient.setQueryData(QUEUE_KEY, optimistic(previous, action, me))
      return { previous }
    },
    onSuccess: (entries, action) => {
      queryClient.setQueryData(QUEUE_KEY, entries)
      if (action.action === "clear") toast("The queue is empty. Everyone back to the lobby.")
      onDone?.()
    },
    onError: (error, _action, context) => {
      if (context?.previous) queryClient.setQueryData(QUEUE_KEY, context.previous)
      toast.error(errorMessage(error))
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUEUE_KEY })
      queryClient.invalidateQueries({ queryKey: VAINQUEUR_KEY })
    },
  })
}
