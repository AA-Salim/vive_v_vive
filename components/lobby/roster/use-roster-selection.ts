"use client"

import { useMemo } from "react"
import { toast } from "sonner"
import { useStoredSelection } from "@/components/lobby/use-stored-selection"
import { LOBBY_SIZE } from "@/lib/lobby/constants"
import type { QueueEntryView, RosterPlayer } from "@/lib/lobby/types"

export const MAX_SELECTION = 20

// Derived from the stored ids on every render: benched or deleted players silently drop out of the selection.
export function useRosterSelection(players: RosterPlayer[], queue: QueueEntryView[], lastLineup: string[]) {
  const [stored, setStored] = useStoredSelection()

  return useMemo(() => {
    const byId = new Map(players.map((p) => [p.id, p]))
    const selected = stored.map((id) => byId.get(id)).filter((p): p is RosterPlayer => !!p?.is_active)
    const selectedIds = new Set(selected.map((p) => p.id))
    const queued = queue.map((e) => e.player_id).filter((id) => byId.get(id)?.is_active)
    const rematch = lastLineup.filter((id) => byId.get(id)?.is_active)

    const write = (ids: string[]) => setStored(ids)
    const toggle = (player: RosterPlayer) => {
      if (selectedIds.has(player.id)) {
        write(selected.filter((p) => p.id !== player.id).map((p) => p.id))
        return
      }
      if (selected.length >= MAX_SELECTION) {
        toast(`${MAX_SELECTION} is plenty. Drop someone first.`)
        return
      }
      write([...selected.map((p) => p.id), player.id])
    }
    const seatQueue = () => {
      const seated = queued.slice(0, LOBBY_SIZE)
      const rest = selected.map((p) => p.id).filter((id) => !seated.includes(id))
      write([...seated, ...rest].slice(0, Math.max(LOBBY_SIZE, seated.length)))
      toast(
        seated.length >= LOBBY_SIZE
          ? "The first ten in the queue are seated."
          : `${seated.length} from the queue seated${rest.length > 0 ? ", the rest kept from your picks" : ""}.`
      )
    }

    return {
      selected,
      selectedIds,
      toggle,
      remove: (player: RosterPlayer) => write(selected.filter((p) => p.id !== player.id).map((p) => p.id)),
      clear: () => write([]),
      seatQueue,
      queueReady: queued.slice(0, LOBBY_SIZE).some((id) => !selectedIds.has(id)) ? Math.min(queued.length, LOBBY_SIZE) : 0,
      canRematch: rematch.length === LOBBY_SIZE && rematch.some((id) => !selectedIds.has(id)),
      rematch: () => write(rematch),
    }
  }, [players, queue, lastLineup, stored, setStored])
}
