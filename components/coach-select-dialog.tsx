"use client"

import { useMemo, useState } from "react"
import { ArrowRightLeftIcon, CheckIcon, GavelIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { CoachAvatar, CoachSlot } from "@/components/lobby/coach-draft/coach-slot"
import { RosterSearch, matchesSearch } from "@/components/lobby/roster/roster-list"
import { useStoredSelection } from "@/components/lobby/use-stored-selection"
import { COACH_POOL_COOKIE, COACH_POOL_PATH, LOBBY_SIZE } from "@/lib/lobby/constants"
import { COACH_HELP } from "@/lib/lobby/help"
import { useCoachProfiles, useRoster } from "@/lib/lobby/queries"
import type { CoachProfile } from "@/lib/lobby/types"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

interface CoachSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string | null
  onConfirm: (blueCoachId: string, redCoachId: string, poolPlayerIds?: string[]) => void
}

function stashPool(pool: string[] | null) {
  document.cookie = pool
    ? `${COACH_POOL_COOKIE}=${pool.join(".")}; path=${COACH_POOL_PATH}; max-age=60; samesite=strict`
    : `${COACH_POOL_COOKIE}=; path=${COACH_POOL_PATH}; max-age=0; samesite=strict`
}

interface PickerProps {
  currentUserId: string | null
  onCancel: () => void
  onConfirm: CoachSelectDialogProps["onConfirm"]
}

function CoachPicker({ currentUserId, onCancel, onConfirm }: PickerProps) {
  const profiles = useCoachProfiles(true)
  const roster = useRoster()
  const [stored] = useStoredSelection()
  const [coaches, setCoaches] = useState<Record<Side, string | null>>({ blue: currentUserId, red: null })
  const [target, setTarget] = useState<Side>(currentUserId ? "red" : "blue")
  const [search, setSearch] = useState("")

  const players = useMemo(() => roster.data ?? [], [roster.data])
  const nameOf = (profile: CoachProfile | null) =>
    profile ? (players.find((p) => p.auth_user_id === profile.id)?.name ?? profile.discord_username) : null
  const list = useMemo(() => {
    const named = (profiles.data ?? []).map((profile) => ({
      profile,
      name: players.find((p) => p.auth_user_id === profile.id)?.name ?? profile.discord_username,
    }))
    return named.filter((entry) => matchesSearch(`${entry.name} ${entry.profile.discord_username}`, search)).sort((a, b) => a.name.localeCompare(b.name))
  }, [profiles.data, players, search])

  const pool = useMemo(() => {
    const active = new Set(players.filter((p) => p.is_active).map((p) => p.id))
    const ids = stored.filter((id) => active.has(id))
    return ids.length >= LOBBY_SIZE ? ids : null
  }, [players, stored])

  const profileOf = (id: string | null) => (id ? (profiles.data?.find((p) => p.id === id) ?? null) : null)
  const assign = (id: string) => {
    const other: Side = target === "blue" ? "red" : "blue"
    const next = { ...coaches, [target]: id }
    if (coaches[other] === id) next[other] = coaches[target]
    setCoaches(next)
    if (!next[other]) setTarget(other)
  }
  const ready = !!coaches.blue && !!coaches.red && coaches.blue !== coaches.red

  return (
    <>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <CoachSlot side="blue" profile={profileOf(coaches.blue)} name={nameOf(profileOf(coaches.blue))} active={target === "blue"} onSelect={() => setTarget("blue")} />
        <Button
          variant="ghost"
          size="icon"
          className="size-10"
          aria-label="Swap the coaches"
          onClick={() => setCoaches((c) => ({ blue: c.red, red: c.blue }))}
          disabled={!coaches.blue && !coaches.red}
        >
          <ArrowRightLeftIcon aria-hidden />
        </Button>
        <CoachSlot side="red" profile={profileOf(coaches.red)} name={nameOf(profileOf(coaches.red))} active={target === "red"} onSelect={() => setTarget("red")} />
      </div>

      <div className="flex min-h-0 flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          {ready ? "Both coaches are named. Tap a slot to change it." : "Tap a name for the highlighted slot."} Coaches need to have signed in here once.
        </p>
        <RosterSearch id="coach-search" value={search} onChange={setSearch} placeholder="Search the court" />
        <div className="max-h-[38dvh] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin]">
          {profiles.isPending ? (
            <div className="flex flex-col gap-1.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-11 rounded-lg" />
              ))}
            </div>
          ) : profiles.isError ? (
            <div className="flex items-center justify-between gap-2 py-3 text-sm text-muted-foreground">
              Could not load the court.
              <Button variant="outline" className="h-10" onClick={() => profiles.refetch()}>
                <RotateCcwIcon aria-hidden />
                Retry
              </Button>
            </div>
          ) : list.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nobody by that name has signed in yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {list.map(({ profile, name }) => {
                const side: Side | null = coaches.blue === profile.id ? "blue" : coaches.red === profile.id ? "red" : null
                return (
                  <li key={profile.id}>
                    <button
                      type="button"
                      onClick={() => assign(profile.id)}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
                        side === "blue" && "bg-[var(--color-blue-team)]/10",
                        side === "red" && "bg-[var(--color-red-team)]/10"
                      )}
                    >
                      <CoachAvatar profile={profile} size={30} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {name}
                          {profile.id === currentUserId && <span className="ml-1.5 text-[10px] font-semibold uppercase text-[var(--color-gold)]">You</span>}
                        </span>
                        {name !== profile.discord_username && <span className="block truncate text-[11px] text-muted-foreground">{profile.discord_username}</span>}
                      </span>
                      {side && (
                        <span
                          className={cn(
                            "flex items-center gap-1 text-[11px] font-semibold uppercase",
                            side === "blue" ? "text-[var(--color-blue-team)]" : "text-[var(--color-red-team)]"
                          )}
                        >
                          <CheckIcon className="size-3.5" aria-hidden />
                          {side}
                        </span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        {pool
          ? `They draft from the ${pool.length} players selected in the roster.`
          : "They draft from every active player. Select ten or more in the roster to limit the pool."}
      </p>

      <DialogFooter>
        <Button variant="outline" className="h-10" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          className="h-10 gap-2 font-semibold"
          disabled={!ready}
          onClick={() => {
            if (!coaches.blue || !coaches.red) return
            stashPool(pool)
            onConfirm(coaches.blue, coaches.red, pool ?? undefined)
            onCancel()
          }}
        >
          <GavelIcon aria-hidden />
          Start the draft
        </Button>
      </DialogFooter>
    </>
  )
}

export function CoachSelectDialog({ open, onOpenChange, currentUserId, onConfirm }: CoachSelectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-1.5 pr-8">
            <DialogTitle className="font-display text-xl">Summon two coaches</DialogTitle>
            <InfoTip help={COACH_HELP.summon} side="bottom" align="start" />
          </div>
          <DialogDescription>They draft the teams in snake order, then set lanes. Champions stay random.</DialogDescription>
        </DialogHeader>
        {open && <CoachPicker currentUserId={currentUserId} onCancel={() => onOpenChange(false)} onConfirm={onConfirm} />}
      </DialogContent>
    </Dialog>
  )
}
