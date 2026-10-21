"use client"

import { motion } from "motion/react"
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpIcon, EllipsisVerticalIcon, ListXIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { QueueEntryView } from "@/lib/lobby/types"
import { cn } from "@/lib/utils"

interface QueueRowProps {
  entry: QueueEntryView
  index: number
  total: number
  called: boolean
  isMe: boolean
  isAdmin: boolean
  now: number
  onMove: (playerId: string, to: number) => void
  onRemove: (entry: QueueEntryView) => void
}

function waited(joinedAt: string, now: number): string {
  if (!now) return ""
  const minutes = Math.max(0, Math.floor((now - Date.parse(joinedAt)) / 60_000))
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours} h ${minutes % 60} min`
}

export function QueueRow({ entry, index, total, called, isMe, isAdmin, now, onMove, onRemove }: QueueRowProps) {
  const pending = entry.id.startsWith("pending-")
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: pending ? 0.6 : 1, y: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex min-h-11 items-center gap-2.5 rounded-lg border px-2.5 py-1",
        isMe ? "border-[var(--color-gold)]/45 bg-[var(--color-gold)]/[0.08]" : called ? "border-[var(--color-gold)]/20 bg-muted/40" : "border-transparent bg-muted/20"
      )}
    >
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums",
          index === 0 ? "bg-[var(--color-gold)] text-[var(--color-navy)]" : called ? "bg-[var(--color-gold)]/20 text-[var(--color-gold)]" : "bg-muted text-muted-foreground"
        )}
      >
        <span className="sr-only">Position </span>
        {index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-[var(--color-gold-light)]">{entry.name}</span>
          {isMe && <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-gold)]">You</span>}
        </span>
        {index === 0 && <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-gold)]">Next up</span>}
      </span>
      <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{waited(entry.joined_at, now)}</span>
      {isAdmin && !pending && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Manage ${entry.name} in the queue`}
            className="-mr-1.5 flex size-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <EllipsisVerticalIcon className="size-4" aria-hidden />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="truncate">{entry.name}</DropdownMenuLabel>
              <DropdownMenuItem className="min-h-10" disabled={index === 0} onClick={() => onMove(entry.player_id, 0)}>
                <ChevronsUpIcon aria-hidden />
                Move to the front
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-10" disabled={index === 0} onClick={() => onMove(entry.player_id, index - 1)}>
                <ArrowUpIcon aria-hidden />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem className="min-h-10" disabled={index === total - 1} onClick={() => onMove(entry.player_id, index + 1)}>
                <ArrowDownIcon aria-hidden />
                Move down
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" className="min-h-10" onClick={() => onRemove(entry)}>
              <ListXIcon aria-hidden />
              Remove from the queue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </motion.li>
  )
}
