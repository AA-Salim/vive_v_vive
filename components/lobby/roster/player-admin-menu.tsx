"use client"

import { ArmchairIcon, EllipsisVerticalIcon, ListEndIcon, ListXIcon, PencilIcon, Trash2Icon, UndoDotIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { RosterPlayer } from "@/lib/lobby/types"

export type PlayerIntent = "rename" | "bench" | "activate" | "queue" | "unqueue" | "delete"

interface PlayerAdminMenuProps {
  player: RosterPlayer
  queued: boolean
  onIntent: (intent: PlayerIntent, player: RosterPlayer) => void
}

export function canDelete(player: RosterPlayer) {
  return player.games_played === 0 && !player.auth_user_id
}

export function PlayerAdminMenu({ player, queued, onIntent }: PlayerAdminMenuProps) {
  const deletable = canDelete(player)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Manage ${player.name}`}
        className="flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-popup-open:bg-muted"
      >
        <EllipsisVerticalIcon className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="truncate">{player.name}</DropdownMenuLabel>
          <DropdownMenuItem className="min-h-10" onClick={() => onIntent("rename", player)}>
            <PencilIcon aria-hidden />
            Rename
          </DropdownMenuItem>
          {player.is_active && (
            <DropdownMenuItem className="min-h-10" onClick={() => onIntent(queued ? "unqueue" : "queue", player)}>
              {queued ? <ListXIcon aria-hidden /> : <ListEndIcon aria-hidden />}
              {queued ? "Remove from the queue" : "Put in the queue"}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className="min-h-10" onClick={() => onIntent(player.is_active ? "bench" : "activate", player)}>
            {player.is_active ? <ArmchairIcon aria-hidden /> : <UndoDotIcon aria-hidden />}
            {player.is_active ? "Bench" : "Bring back"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="min-h-10"
          disabled={!deletable}
          onClick={() => onIntent("delete", player)}
        >
          <Trash2Icon aria-hidden />
          <span className="flex flex-col">
            Delete
            {!deletable && <span className="text-[11px] text-muted-foreground">Has history: bench instead</span>}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
