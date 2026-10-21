"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { QUEUE_KEY, ROSTER_KEY, errorMessage, sendJson } from "@/lib/lobby/queries"
import type { QueueEntryView, RosterPlayer } from "@/lib/lobby/types"

type Patch = { name?: string; is_active?: boolean }

export function useRosterActions() {
  const queryClient = useQueryClient()

  const snapshot = async () => {
    await queryClient.cancelQueries({ queryKey: ROSTER_KEY })
    return queryClient.getQueryData<RosterPlayer[]>(ROSTER_KEY)
  }
  const restore = (previous: RosterPlayer[] | undefined) => {
    if (previous) queryClient.setQueryData(ROSTER_KEY, previous)
  }
  const settle = () => {
    queryClient.invalidateQueries({ queryKey: ROSTER_KEY })
  }

  const add = useMutation({
    mutationKey: ["sessions", "players", "add"],
    mutationFn: (name: string) => sendJson<RosterPlayer>("/api/players", { name }),
    onSuccess: (player) => {
      queryClient.setQueryData<RosterPlayer[]>(ROSTER_KEY, (list) =>
        [...(list ?? []).filter((p) => p.id !== player.id), player].sort((a, b) => a.name.localeCompare(b.name))
      )
      toast.success(`${player.name} joins the roster.`)
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: settle,
  })

  const update = useMutation({
    mutationKey: ["sessions", "players", "update"],
    mutationFn: ({ id, patch }: { id: string; patch: Patch }) => sendJson<RosterPlayer>(`/api/players/${id}`, patch, "PATCH"),
    onMutate: async ({ id, patch }) => {
      const previous = await snapshot()
      queryClient.setQueryData<RosterPlayer[]>(ROSTER_KEY, (list) => (list ?? []).map((p) => (p.id === id ? { ...p, ...patch } : p)))
      return { previous }
    },
    onError: (error, _vars, context) => {
      restore(context?.previous)
      toast.error(errorMessage(error))
    },
    onSettled: (_data, _error, { patch }) => {
      settle()
      if (patch.is_active === false) queryClient.invalidateQueries({ queryKey: QUEUE_KEY })
    },
  })

  const remove = useMutation({
    mutationKey: ["sessions", "players", "remove"],
    mutationFn: (player: RosterPlayer) => sendJson<{ success: boolean }>(`/api/players/${player.id}`, undefined, "DELETE"),
    onMutate: async (player) => {
      const previous = await snapshot()
      queryClient.setQueryData<RosterPlayer[]>(ROSTER_KEY, (list) => (list ?? []).filter((p) => p.id !== player.id))
      return { previous }
    },
    onSuccess: (_data, player) => toast(`${player.name} was struck from the roster.`),
    onError: (error, _player, context) => {
      restore(context?.previous)
      toast.error(errorMessage(error))
    },
    onSettled: settle,
  })

  const queue = useMutation({
    mutationKey: ["queue", "admin"],
    mutationFn: ({ player, join }: { player: RosterPlayer; join: boolean }) =>
      sendJson<QueueEntryView[]>("/api/queue", { action: join ? "join" : "leave", player_id: player.id }),
    onSuccess: (entries, { player, join }) => {
      queryClient.setQueryData(QUEUE_KEY, entries)
      toast(join ? `${player.name} is in the queue.` : `${player.name} left the queue.`)
    },
    onError: (error) => toast.error(errorMessage(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: QUEUE_KEY }),
  })

  const bench = (player: RosterPlayer, active: boolean) =>
    update.mutate(
      { id: player.id, patch: { is_active: active } },
      {
        onSuccess: () =>
          toast(active ? `${player.name} is back on the roster.` : `${player.name} is benched.`, {
            action: { label: "Undo", onClick: () => update.mutate({ id: player.id, patch: { is_active: !active } }) },
          }),
      }
    )

  return { add, update, remove, queue, bench }
}
