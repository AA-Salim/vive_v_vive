"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { CheckIcon, CrownIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChampionAvatar } from "@/components/session/champion-avatar"
import { byLane } from "@/components/session/board-types"
import { SIDE_NAME } from "@/components/session/copy"
import { GAME_PARTICIPATION_POINTS, GAME_WIN_POINTS } from "@/lib/session/constants"
import type { RoomSession } from "@/lib/session/types"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

export interface BetSummary {
  total: number
  count: number
  blue: number
  red: number
}

export function useBetSummary(sessionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["bets", "summary", sessionId],
    enabled,
    staleTime: 5_000,
    queryFn: async (): Promise<BetSummary | null> => {
      const res = await fetch(`/api/sessions/${sessionId}/bets`)
      if (!res.ok) return null
      const body = (await res.json()) as Record<string, unknown> | null
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0)
      if (!body) return null
      return { total: num(body.total), count: num(body.bet_count), blue: num(body.blue_total), red: num(body.red_total) }
    },
  })
}

interface DeclareWinnerDialogProps {
  session: RoomSession
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  onConfirm: (side: Side) => void
}

export function DeclareWinnerDialog({ session, open, onOpenChange, pending, onConfirm }: DeclareWinnerDialogProps) {
  const [choice, setChoice] = useState<Side | null>(null)
  const { data: bets } = useBetSummary(session.id, open)

  const close = (next: boolean) => {
    if (!next) setChoice(null)
    onOpenChange(next)
  }

  const backed = choice && bets ? (choice === "blue" ? bets.blue : bets.red) : 0

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Who took the Nexus?</DialogTitle>
          <DialogDescription>Pick the side that won. This settles every wager and cannot be undone.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3" role="group" aria-label="Winning side">
          {(["blue", "red"] as const).map((side) => {
            const team = session.session_assignments.filter((a) => a.side === side).sort(byLane)
            const selected = choice === side
            return (
              <button
                key={side}
                type="button"
                aria-pressed={selected}
                onClick={() => setChoice(side)}
                className={cn(
                  "relative flex min-h-28 flex-col items-start gap-2 rounded-xl border-2 p-3 text-left outline-none transition-[border-color,background-color,box-shadow] focus-visible:ring-3 focus-visible:ring-ring/50",
                  side === "blue"
                    ? "border-[var(--color-blue-team)]/30 hover:border-[var(--color-blue-team)]/70"
                    : "border-[var(--color-red-team)]/30 hover:border-[var(--color-red-team)]/70",
                  selected && side === "blue" && "border-[var(--color-blue-team)] bg-[var(--color-blue-team)]/15",
                  selected && side === "red" && "border-[var(--color-red-team)] bg-[var(--color-red-team)]/15"
                )}
              >
                <span
                  className={cn(
                    "font-display text-sm font-semibold uppercase tracking-[0.18em]",
                    side === "blue" ? "text-[var(--color-blue-team)]" : "text-[var(--color-red-team)]"
                  )}
                >
                  {SIDE_NAME[side]}
                </span>
                <span className="flex -space-x-2">
                  {team.map((a) => (
                    <ChampionAvatar key={a.id} assignment={a} size={30} rounded="full" className="ring-card" />
                  ))}
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{team.map((a) => a.players.name).join(", ")}</span>
                {selected && (
                  <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-[var(--color-gold)] text-[var(--color-navy)]">
                    <CheckIcon className="size-4" aria-hidden />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <ul className="space-y-1.5 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          <li>
            {bets && bets.count > 0
              ? choice
                ? `${bets.count} bets, ${bets.total} points on the table: ${SIDE_NAME[choice]} backers (${backed} points staked) get paid.`
                : `${bets.count} bets, ${bets.total} points on the table, paid out to the winning side.`
              : "No bets this game: nothing to pay out."}
          </li>
          <li>Decrees, duels, prophecies and bounties settle right after.</li>
          <li>
            Winners earn +{GAME_WIN_POINTS}, the losing side +{GAME_PARTICIPATION_POINTS}. All ten champions join today&apos;s fearless bans.
          </li>
        </ul>

        <DialogFooter>
          <Button variant="outline" className="h-10" onClick={() => close(false)} disabled={pending}>
            Not yet
          </Button>
          <Button
            className={cn(
              "h-10 font-semibold",
              choice === "blue" && "bg-[var(--color-blue-team)] text-white hover:bg-[var(--color-blue-team)]/85",
              choice === "red" && "bg-[var(--color-red-team)] text-white hover:bg-[var(--color-red-team)]/85"
            )}
            disabled={!choice || pending}
            onClick={() => choice && onConfirm(choice)}
          >
            {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : <CrownIcon aria-hidden />}
            {choice ? `Confirm ${SIDE_NAME[choice]} victory` : "Pick the winner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
