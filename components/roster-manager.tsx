"use client"

import { useMemo, useState } from "react"
import { ChevronRightIcon, DicesIcon, GavelIcon, Loader2Icon, RotateCcwIcon, UserPlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/session/confirm-dialog"
import { useMediaQuery } from "@/components/session/use-browser-state"
import { useNow } from "@/components/session/use-clock"
import { byActivity } from "@/components/lobby/player-stats"
import { canDelete, type PlayerIntent } from "@/components/lobby/roster/player-admin-menu"
import { PlayerNameDialog } from "@/components/lobby/roster/player-name-dialog"
import { RosterList, RosterSearch } from "@/components/lobby/roster/roster-list"
import { RosterSheet } from "@/components/lobby/roster/roster-sheet"
import { SelectionTray } from "@/components/lobby/roster/selection-tray"
import { useRosterActions } from "@/components/lobby/roster/use-roster-actions"
import { useRosterSelection } from "@/components/lobby/roster/use-roster-selection"
import { useAuth } from "@/hooks/use-auth"
import { useSession } from "@/hooks/use-session"
import { ACTIVE_STATUSES } from "@/lib/live/events"
import { LOBBY_SIZE } from "@/lib/lobby/constants"
import { useQueue, useRoster } from "@/lib/lobby/queries"
import type { RosterPlayer } from "@/lib/lobby/types"
import type { Player } from "@/lib/types"

interface RosterManagerProps {
  onRandomize: (players: Player[]) => void
  onCoachDraft?: () => void
  isAdmin?: boolean
  disabled?: boolean
}

const QUICK_PICKS = 8

type NameConfig = { mode: "add" } | { mode: "rename"; player: RosterPlayer }

function RosterSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading the roster">
      <Skeleton className="h-5 w-48" />
      <div className="grid grid-cols-5 gap-1.5">
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-10 rounded-lg" />
        ))}
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-12 rounded-xl" />
      ))}
    </div>
  )
}

export function RosterManager({ onRandomize, onCoachDraft, isAdmin = false, disabled = false }: RosterManagerProps) {
  const roster = useRoster()
  const queue = useQueue()
  const { profile } = useAuth()
  const { session } = useSession()
  const actions = useRosterActions()
  const wide = useMediaQuery("(min-width: 640px)")
  const now = useNow(60_000) ?? 0
  const [search, setSearch] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)
  const [nameDialog, setNameDialog] = useState<{ open: boolean; config: NameConfig }>({ open: false, config: { mode: "add" } })
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; player: RosterPlayer | null }>({ open: false, player: null })
  const openNameDialog = (config: NameConfig) => setNameDialog({ open: true, config })
  const closeNameDialog = () => setNameDialog((dialog) => ({ ...dialog, open: false }))
  const closeDeleteDialog = () => setDeleteDialog((dialog) => ({ ...dialog, open: false }))
  const deleteTarget = deleteDialog.player
  const nameConfig = nameDialog.config

  const players = useMemo(() => roster.data ?? [], [roster.data])
  const queueEntries = useMemo(() => queue.data ?? [], [queue.data])
  const lastLineup = useMemo(
    () => (session && !ACTIVE_STATUSES.includes(session.status) ? session.session_assignments.map((a) => a.player_id) : []),
    [session]
  )
  const selection = useRosterSelection(players, queueEntries, lastLineup)
  const active = useMemo(() => players.filter((p) => p.is_active).sort(byActivity), [players])
  const benched = useMemo(() => players.filter((p) => !p.is_active).sort((a, b) => a.name.localeCompare(b.name)), [players])
  const queuePositions = useMemo(() => new Map(queueEntries.map((e, i) => [e.player_id, i + 1])), [queueEntries])

  const count = selection.selected.length
  const ready = count === LOBBY_SIZE

  const onIntent = (intent: PlayerIntent, player: RosterPlayer) => {
    if (intent === "rename") openNameDialog({ mode: "rename", player })
    else if (intent === "delete") setDeleteDialog({ open: true, player })
    else if (intent === "bench" || intent === "activate") actions.bench(player, intent === "activate")
    else actions.queue.mutate({ player, join: intent === "queue" })
  }

  const listProps = {
    selectedIds: selection.selectedIds,
    full: count >= LOBBY_SIZE,
    meId: profile?.player_id ?? null,
    queuePositions,
    isAdmin,
    now,
    onToggle: selection.toggle,
    onIntent,
  }

  const rollLabel = disabled
    ? "Rolling the dice..."
    : ready
      ? "Roll the teams"
      : count < LOBBY_SIZE
        ? `Pick ${LOBBY_SIZE - count} more`
        : `${count - LOBBY_SIZE} too many to roll`
  const poolHint =
    count >= LOBBY_SIZE ? `Coaches draft from your ${count} picks.` : "Coaches draft from every active player."

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--color-gold)]/25 bg-card p-4 shadow-[0_18px_48px_-28px_var(--color-gold)] sm:p-5">
      <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/70 to-transparent" />
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold tracking-wide text-[var(--color-gold)]">The Roster</h2>
          <p className="text-xs text-muted-foreground">Tap ten names. The regulars sit on top.</p>
        </div>
        {isAdmin && (
          <Button variant="outline" className="h-10 shrink-0 gap-2" onClick={() => openNameDialog({ mode: "add" })}>
            <UserPlusIcon aria-hidden />
            Add player
          </Button>
        )}
      </header>

      {roster.isPending ? (
        <RosterSkeleton />
      ) : roster.isError && players.length === 0 ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm text-muted-foreground">The roster scroll is unreadable right now.</p>
          <Button variant="outline" className="h-10" onClick={() => roster.refetch()} disabled={roster.isFetching}>
            <RotateCcwIcon className={roster.isFetching ? "animate-spin" : undefined} aria-hidden />
            Try again
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <SelectionTray
            selected={selection.selected}
            queueReady={selection.queueReady}
            canRematch={selection.canRematch}
            onRemove={selection.remove}
            onSeatQueue={selection.seatQueue}
            onRematch={selection.rematch}
            onClear={selection.clear}
          />

          {wide ? (
            <>
              <RosterSearch id="roster-search" value={search} onChange={setSearch} />
              <div className="max-h-[26rem] overflow-y-auto overscroll-contain pr-1 pb-3 [mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)] [scrollbar-width:thin]">
                <RosterList {...listProps} players={active} benched={isAdmin ? benched : []} search={search} columns />
              </div>
            </>
          ) : (
            <>
              <RosterList {...listProps} players={active.slice(0, QUICK_PICKS)} benched={[]} search="" />
              <Button variant="outline" className="h-11 justify-between rounded-xl" onClick={() => setSheetOpen(true)}>
                Search all {active.length} players{isAdmin && benched.length > 0 ? ` and ${benched.length} benched` : ""}
                <ChevronRightIcon aria-hidden />
              </Button>
            </>
          )}

          <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
            <Button
              className="h-12 gap-2 rounded-xl text-base font-semibold shadow-[0_8px_24px_-12px_var(--color-gold)] disabled:shadow-none sm:flex-1"
              disabled={!ready || disabled}
              onClick={() => onRandomize(selection.selected)}
            >
              {disabled ? <Loader2Icon className="animate-spin" aria-hidden /> : <DicesIcon aria-hidden />}
              {rollLabel}
            </Button>
            {onCoachDraft && (
              <Button variant="outline" className="h-12 gap-2 rounded-xl sm:px-5" disabled={disabled} onClick={onCoachDraft}>
                <GavelIcon aria-hidden />
                Coach draft
              </Button>
            )}
          </div>
          {onCoachDraft && <p className="-mt-2 text-center text-[11px] text-muted-foreground sm:text-right">{poolHint}</p>}
        </div>
      )}

      {!wide && (
        <RosterSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          count={count}
          search={<RosterSearch id="roster-sheet-search" value={search} onChange={setSearch} />}
        >
          <RosterList {...listProps} players={active} benched={isAdmin ? benched : []} search={search} />
        </RosterSheet>
      )}

      <PlayerNameDialog
        open={nameDialog.open}
        onOpenChange={(open) => !open && closeNameDialog()}
        mode={nameConfig.mode}
        initialName={nameConfig.mode === "rename" ? nameConfig.player.name : ""}
        pending={actions.add.isPending || actions.update.isPending}
        onSubmit={(name) => {
          const done = { onSuccess: closeNameDialog }
          if (nameConfig.mode === "rename") actions.update.mutate({ id: nameConfig.player.id, patch: { name } }, done)
          else actions.add.mutate(name, done)
        }}
      />
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => !open && closeDeleteDialog()}
        title={`Strike ${deleteTarget?.name ?? "this player"} from the roster?`}
        description={
          deleteTarget && canDelete(deleteTarget)
            ? "They have never played, so nothing else is lost. This cannot be undone."
            : "Players with history can only be benched."
        }
        confirmLabel="Delete for good"
        destructive
        pending={actions.remove.isPending}
        onConfirm={() => {
          if (deleteTarget) actions.remove.mutate(deleteTarget, { onSettled: closeDeleteDialog })
        }}
      />
    </div>
  )
}
