"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ArmchairIcon, CrownIcon, EllipsisVerticalIcon, HandIcon, Loader2Icon, PowerIcon, RotateCcwIcon, ShuffleIcon, SwordsIcon, TrophyIcon, UndoDotIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HelpRows, InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ConfirmDialog } from "@/components/session/confirm-dialog"
import { RotationBoard } from "@/components/lobby/vainqueur/rotation-board"
import { useVainqueurActions } from "@/components/lobby/vainqueur/use-vainqueur-actions"
import { useAuth } from "@/hooks/use-auth"
import { useSession } from "@/hooks/use-session"
import { ACTIVE_STATUSES } from "@/lib/live/events"
import { ROTATION_HELP } from "@/lib/lobby/help"
import { useQueue, useVainqueur } from "@/lib/lobby/queries"
import { planRotation } from "@/lib/lobby/rotation"
import type { HelpEntry } from "@/lib/help"
import type { RotationMode } from "@/lib/lobby/types"

interface VainqueurControlsProps {
  isAdmin: boolean
  currentPlayerId: string | null
  sessionResolved?: boolean
  onNextGame?: () => void
}

const SHELL = "rounded-xl border border-border bg-card p-4"
const TOGGLE =
  "h-10 gap-1.5 text-xs aria-pressed:border-[var(--color-gold)]/50 aria-pressed:bg-[var(--color-gold)]/12 aria-pressed:text-[var(--color-gold)]"

function Title({ live, children }: { live: boolean; children?: ReactNode }) {
  return (
    <header className="flex items-center gap-2">
      <TrophyIcon className="size-4 text-[var(--color-gold)]" aria-hidden />
      <h2 className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]">Winner Stays</h2>
      <InfoTip help={ROTATION_HELP.board} />
      {live && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-gold)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-gold)]">
          <span aria-hidden className="size-1.5 rounded-full bg-[var(--color-gold)] motion-safe:animate-pulse" />
          On
        </span>
      )}
      <span className="ml-auto" />
      {children}
    </header>
  )
}

function WithTip({ help, children }: { help: HelpEntry; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      <InfoTip help={help} align="end" />
    </div>
  )
}

export function VainqueurControls({ isAdmin, currentPlayerId, onNextGame }: VainqueurControlsProps) {
  const vainqueur = useVainqueur()
  const queue = useQueue()
  const { user, profile } = useAuth()
  const { session } = useSession()
  const [mode, setMode] = useState<RotationMode>("throne")
  const [confirmOff, setConfirmOff] = useState(false)
  const myId = currentPlayerId ?? profile?.player_id ?? null
  const { state, rotate } = useVainqueurActions(myId, onNextGame)

  const view = vainqueur.data
  const entries = useMemo(() => queue.data ?? [], [queue.data])
  const plan = useMemo(() => {
    if (!view?.active || !view.lastSessionId) return null
    return planRotation({
      winners: view.winners.map((p) => p.id),
      satOut: view.satOut.map((p) => p.id),
      losers: view.losers.map((p) => p.id),
      volunteers: view.volunteers,
      queue: entries.map((e) => e.player_id),
    })
  }, [view, entries])

  if (vainqueur.isPending) {
    return isAdmin ? <Skeleton className="h-28 rounded-xl" aria-label="Loading the rotation" /> : null
  }
  if (!view) {
    return isAdmin ? (
      <section className={SHELL} role="alert">
        <Title live={false} />
        <div className="mt-2 flex items-center justify-between gap-2 text-sm text-muted-foreground">
          The rotation ledger is unreadable.
          <Button variant="outline" className="h-10" onClick={() => vainqueur.refetch()}>
            <RotateCcwIcon aria-hidden />
            Retry
          </Button>
        </div>
      </section>
    ) : null
  }

  const busy = state.isPending || rotate.isPending

  if (!view.active) {
    if (!isAdmin) return null
    return (
      <section aria-label="Winner stays" className={SHELL}>
        <Title live={false} />
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Winners keep their seats, the queue takes the losers&apos; places, and losers only stay when the line runs dry.
        </p>
        <div className="mt-3">
          <WithTip help={ROTATION_HELP.start}>
            <Button variant="outline" className="h-11 w-full gap-2" disabled={busy} onClick={() => state.mutate({ action: "activate" })}>
              {state.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : <CrownIcon aria-hidden />}
              Start winner stays
            </Button>
          </WithTip>
        </div>
      </section>
    )
  }

  const names = new Map([...view.winners, ...view.satOut, ...view.losers].map((p) => [p.id, p.name]))
  entries.forEach((e) => names.set(e.player_id, e.name))
  const nameOf = (id: string) => names.get(id) ?? "Someone"
  const gameRunning = !!session && ACTIVE_STATUSES.includes(session.status)
  const canRotate = isAdmin || (!!user && user.id === view.hostUserId)
  const isWinner = !!myId && view.winners.some((p) => p.id === myId)
  const satOut = !!myId && view.satOut.some((p) => p.id === myId)
  const isLoser = !!myId && view.losers.some((p) => p.id === myId)
  const volunteered = !!myId && view.volunteers.includes(myId)
  const loserSeats = plan ? plan.loyal.length + plan.lottery.seats : 0

  return (
    <section aria-label="Winner stays" className={SHELL}>
      <Title live>
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Winner stays options"
              className="-mr-2 flex size-10 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <EllipsisVerticalIcon className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem variant="destructive" className="min-h-10" onClick={() => setConfirmOff(true)}>
                <PowerIcon aria-hidden />
                Turn it off
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Title>

      {gameRunning ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          A game is on. When the Nexus falls, its winners keep their seats and {entries.length > 0 ? `the first ${Math.min(entries.length, 5)} in the queue step in.` : "the queue fills the rest."}
        </p>
      ) : !plan ? (
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          The next game decides who holds the throne. Roll it from the roster as usual.
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <RotationBoard plan={plan} satOut={view.satOut.map((p) => p.id)} volunteers={view.volunteers} nameOf={nameOf} myId={myId} />
          {plan.short > 0 && (
            <p className="rounded-lg border border-[var(--color-red-team)]/30 bg-[var(--color-red-team)]/10 px-3 py-2 text-xs text-[var(--color-gold-light)]">
              {plan.short} more {plan.short === 1 ? "player needs" : "players need"} to join the queue for a full lobby.
            </p>
          )}

          {isWinner && (
            <WithTip help={ROTATION_HELP.sitOut}>
              <Button variant="outline" className="h-11 gap-2" disabled={busy} onClick={() => state.mutate({ action: "sit_out" })}>
                <ArmchairIcon aria-hidden />
                Give up my seat
              </Button>
            </WithTip>
          )}
          {satOut && (
            <WithTip help={ROTATION_HELP.takeBack}>
              <Button variant="outline" className="h-11 gap-2" disabled={busy} onClick={() => state.mutate({ action: "return" })}>
                <UndoDotIcon aria-hidden />
                Take my seat back
              </Button>
            </WithTip>
          )}
          {isLoser &&
            (loserSeats === 0 && !volunteered ? (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                The queue covers every seat: all losers rotate out this time.
                <InfoTip help={ROTATION_HELP.volunteer} align="end" />
              </p>
            ) : (
              <WithTip help={ROTATION_HELP.volunteer}>
                <Button
                  variant="outline"
                  className={volunteered ? "h-11 gap-2 border-[var(--color-gold)]/50 text-[var(--color-gold)]" : "h-11 gap-2"}
                  aria-pressed={volunteered}
                  disabled={busy}
                  onClick={() => state.mutate({ action: volunteered ? "unvolunteer" : "volunteer" })}
                >
                  <HandIcon aria-hidden />
                  {volunteered ? "Volunteered. Tap to withdraw" : "Volunteer to stay"}
                </Button>
              </WithTip>
            ))}

          {canRotate && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <div className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Next teams
                <InfoTip help={ROTATION_HELP.mode} align="start" />
              </div>
              <ToggleGroup
                value={[mode]}
                onValueChange={(value: string[]) => value[0] && setMode(value[0] as RotationMode)}
                className="grid w-full grid-cols-2"
                aria-label="How to form the next teams"
              >
                <ToggleGroupItem value="throne" variant="outline" className={TOGGLE}>
                  <CrownIcon aria-hidden />
                  Champions together
                </ToggleGroupItem>
                <ToggleGroupItem value="shuffle" variant="outline" className={TOGGLE}>
                  <ShuffleIcon aria-hidden />
                  Mix all ten
                </ToggleGroupItem>
              </ToggleGroup>
              <WithTip help={ROTATION_HELP.rotate}>
                <Button
                  className="h-12 gap-2 text-base font-semibold"
                  disabled={busy || plan.short > 0}
                  onClick={() => rotate.mutate(mode)}
                >
                  {rotate.isPending ? <Loader2Icon className="animate-spin" aria-hidden /> : <SwordsIcon aria-hidden />}
                  {rotate.isPending ? "Turning the wheel..." : "Rotate and deal"}
                </Button>
              </WithTip>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOff}
        onOpenChange={setConfirmOff}
        title="Turn winner stays off?"
        description="The current winners, losers and volunteers are forgotten. The queue stays as it is."
        confirmLabel="Turn it off"
        destructive
        pending={state.isPending}
        onConfirm={() => state.mutate({ action: "deactivate" }, { onSettled: () => setConfirmOff(false) })}
      >
        <HelpRows help={ROTATION_HELP.off} />
      </ConfirmDialog>
    </section>
  )
}
