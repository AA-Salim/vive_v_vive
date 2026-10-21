"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AnimatePresence } from "motion/react"
import { EllipsisVerticalIcon, ListOrderedIcon, Loader2Icon, LogInIcon, RotateCcwIcon, Trash2Icon, UserPlusIcon, UserMinusIcon } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/session/confirm-dialog"
import { useNow } from "@/components/session/use-clock"
import { QueueRow } from "@/components/lobby/queue/queue-row"
import { useQueueActions } from "@/components/lobby/queue/use-queue-actions"
import { useAuth } from "@/hooks/use-auth"
import { useSession } from "@/hooks/use-session"
import { ACTIVE_STATUSES } from "@/lib/live/events"
import { LOBBY_SIZE, TEAM_SIZE } from "@/lib/lobby/constants"
import { useQueue, useVainqueur } from "@/lib/lobby/queries"
import { planRotation } from "@/lib/lobby/rotation"
import { cn } from "@/lib/utils"

interface QueuePanelProps {
  currentPlayerId: string | null
  onUpdate?: () => void
}

export function QueuePanel({ currentPlayerId, onUpdate }: QueuePanelProps) {
  const queue = useQueue()
  const vainqueur = useVainqueur()
  const { user, profile, isAdmin, isLoading: authLoading, signIn } = useAuth()
  const { session } = useSession()
  const now = useNow(30_000) ?? 0
  const [confirmClear, setConfirmClear] = useState(false)

  const playerId = currentPlayerId ?? profile?.player_id ?? null
  const me = playerId ? { playerId, name: profile?.players?.name ?? "You", userId: user?.id ?? null } : null
  const action = useQueueActions(me, onUpdate)

  const entries = useMemo(() => queue.data ?? [], [queue.data])
  const myIndex = playerId ? entries.findIndex((e) => e.player_id === playerId) : -1
  const rotation = vainqueur.data?.active ? vainqueur.data : null
  const gameRunning = !!session && ACTIVE_STATUSES.includes(session.status)

  const called = useMemo(() => {
    if (!rotation) return new Set<string>()
    if (rotation.lastSessionId) {
      const plan = planRotation({
        winners: rotation.winners.map((p) => p.id),
        satOut: rotation.satOut.map((p) => p.id),
        losers: rotation.losers.map((p) => p.id),
        volunteers: rotation.volunteers,
        queue: entries.map((e) => e.player_id),
      })
      return new Set(plan.comingIn)
    }
    return new Set(entries.slice(0, LOBBY_SIZE - TEAM_SIZE).map((e) => e.player_id))
  }, [rotation, entries])

  const line =
    entries.length === 0
      ? "Nobody is waiting. The Rift is short on volunteers."
      : rotation?.lastSessionId
        ? called.size > 0
          ? `The next rotation calls up the first ${called.size}.`
          : "Nobody here gets called this rotation."
        : rotation
          ? `Winners stay. The first ${Math.min(entries.length, TEAM_SIZE)} here take the losers' seats.`
          : `${entries.length} waiting. The host can seat them from the roster in one tap.`

  const busy = action.isPending
  const myButton = authLoading ? (
    <Skeleton className="h-11 w-full rounded-md" aria-label="Checking your seat" />
  ) : !user ? (
    <Button variant="outline" className="h-11 w-full gap-2" onClick={signIn}>
      <LogInIcon aria-hidden />
      Sign in to queue
    </Button>
  ) : !playerId ? (
    <Link href="/profile" className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}>
      Claim your player to queue
    </Link>
  ) : myIndex >= 0 ? (
    <Button
      variant="outline"
      className="h-11 w-full gap-2 hover:border-[var(--color-red-team)]/50 hover:text-[var(--color-red-team)]"
      disabled={busy}
      onClick={() => action.mutate({ action: "leave" })}
    >
      {busy ? <Loader2Icon className="animate-spin" aria-hidden /> : <UserMinusIcon aria-hidden />}
      Leave the queue · #{myIndex + 1}
    </Button>
  ) : (
    <Button className="h-11 w-full gap-2 font-semibold" disabled={busy} onClick={() => action.mutate({ action: "join" })}>
      {busy ? <Loader2Icon className="animate-spin" aria-hidden /> : <UserPlusIcon aria-hidden />}
      {gameRunning ? "Queue for the next game" : "Join the queue"}
    </Button>
  )

  return (
    <section aria-labelledby="queue-title" className="rounded-xl border border-border bg-card p-4">
      <header className="flex items-center gap-2">
        <ListOrderedIcon className="size-4 text-[var(--color-gold)]" aria-hidden />
        <h2 id="queue-title" className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]">
          The Queue
        </h2>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {queue.isPending ? "..." : `${entries.length} waiting`}
        </span>
        {isAdmin && entries.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Queue options"
              className="-mr-2 flex size-10 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <EllipsisVerticalIcon className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem variant="destructive" className="min-h-10" onClick={() => setConfirmClear(true)}>
                <Trash2Icon aria-hidden />
                Clear the queue
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {queue.isPending ? (
        <div className="mt-3 flex flex-col gap-1.5" aria-label="Loading the queue">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-11 rounded-lg" />
          ))}
        </div>
      ) : queue.isError && entries.length === 0 ? (
        <div role="alert" className="mt-3 flex items-center justify-between gap-2 text-sm text-muted-foreground">
          The queue ledger is unreadable.
          <Button variant="outline" className="h-10" onClick={() => queue.refetch()}>
            <RotateCcwIcon aria-hidden />
            Retry
          </Button>
        </div>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted-foreground">{line}</p>
          {entries.length > 0 && (
            <ol className="mt-3 flex flex-col gap-1.5" aria-label="Players in the queue">
              <AnimatePresence initial={false}>
                {entries.map((entry, index) => (
                  <QueueRow
                    key={entry.player_id}
                    entry={entry}
                    index={index}
                    total={entries.length}
                    called={called.has(entry.player_id)}
                    isMe={entry.player_id === playerId}
                    isAdmin={isAdmin}
                    now={now}
                    onMove={(id, to) => action.mutate({ action: "move", player_id: id, to })}
                    onRemove={(e) => action.mutate({ action: "leave", player_id: e.player_id })}
                  />
                ))}
              </AnimatePresence>
            </ol>
          )}
          <div className="mt-3">{myButton}</div>
        </>
      )}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear the queue?"
        description={`All ${entries.length} waiting players lose their spot. They can queue again with one tap.`}
        confirmLabel="Clear the queue"
        destructive
        pending={busy}
        onConfirm={() => action.mutate({ action: "clear" }, { onSettled: () => setConfirmClear(false) })}
      />
    </section>
  )
}
