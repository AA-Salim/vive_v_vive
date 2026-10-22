"use client"

import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckIcon, Loader2Icon, RefreshCwIcon, ScrollTextIcon, SearchIcon, UsersRoundIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Crest } from "@/components/ui/crest"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { EmptyState } from "@/components/ui/empty-state"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { PROFILE_ROOT } from "@/lib/live/events"
import type { Player } from "@/lib/types"
import { cn } from "@/lib/utils"

interface ClaimPlayerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type RosterPlayer = Player & { auth_user_id?: string | null }

const CLAIMABLE_KEY = [PROFILE_ROOT, "claimable-players"] as const

class ClaimError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
  }
}

async function fetchClaimable(signal: AbortSignal): Promise<RosterPlayer[]> {
  const res = await fetch("/api/players", { signal, cache: "no-store" })
  if (!res.ok) throw new Error(`GET /api/players failed with ${res.status}`)
  const data = (await res.json()) as unknown
  return Array.isArray(data) ? (data as RosterPlayer[]).filter((p) => !p.auth_user_id) : []
}

async function claimPlayer(player: RosterPlayer): Promise<RosterPlayer> {
  const res = await fetch("/api/auth/link-player", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player_id: player.id }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new ClaimError(res.status, body?.error ?? "The claim did not go through")
  }
  return player
}

function initialOf(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?"
}

export function ClaimPlayerDialog({ open, onOpenChange }: ClaimPlayerDialogProps) {
  const { refetchProfile } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const players = useQuery({
    queryKey: CLAIMABLE_KEY,
    queryFn: ({ signal }) => fetchClaimable(signal),
    enabled: open,
    staleTime: 0,
  })

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearch("")
      setSelectedId(null)
    }
    onOpenChange(next)
  }

  const claim = useMutation({
    mutationFn: claimPlayer,
    onSuccess: async (player) => {
      toast.success(`Welcome to the court, ${player.name}.`, {
        description: "Your wins, titles and debts now land on the right head.",
      })
      await refetchProfile()
      handleOpenChange(false)
    },
    onError: (error, player) => {
      if (error instanceof ClaimError && error.status === 409) {
        toast.error(`${player.name} was claimed a moment ago.`, { description: "Pick another seat, or complain to the King." })
        setSelectedId(null)
        void queryClient.invalidateQueries({ queryKey: CLAIMABLE_KEY })
        return
      }
      toast.error(error instanceof ClaimError ? error.message : "The claim got lost on the way to the throne. Try again.")
    },
  })

  const list = players.data
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!list) return []
    return needle ? list.filter((p) => p.name.toLowerCase().includes(needle)) : list
  }, [list, search])
  const selected = list?.find((p) => p.id === selectedId) ?? null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-5 sm:max-w-lg">
        <DialogHeader className="flex-row items-start gap-3 pr-8">
          <Crest className="size-11" />
          <div className="min-w-0 space-y-1">
            <DialogTitle>Claim your seat at court</DialogTitle>
            <DialogDescription>
              Pick the roster name that is you. Wins, titles, bounties and debts follow it. Choose honestly: Salaxe keeps a notebook.
            </DialogDescription>
          </div>
        </DialogHeader>

        {list && list.length > 6 && (
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find your name"
              aria-label="Search unclaimed players"
              autoComplete="off"
              className="h-10 pl-9"
            />
          </div>
        )}

        {players.isPending ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-busy="true" aria-label="Loading the roster">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : players.isError ? (
          <EmptyState
            tone="danger"
            icon={ScrollTextIcon}
            title="The roster scroll would not unroll"
            description="The court clerk dropped it. Give it another go."
            action={
              <Button variant="outline" size="lg" onClick={() => void players.refetch()}>
                <RefreshCwIcon />
                Try again
              </Button>
            }
          />
        ) : list && list.length === 0 ? (
          <EmptyState
            icon={UsersRoundIcon}
            title="Every seat is taken"
            description="Ask an admin to add you to the roster first."
          />
        ) : (
          <div
            role="group"
            aria-label="Unclaimed players"
            className="-mx-1 grid max-h-[min(46dvh,20rem)] grid-cols-2 gap-2 overflow-y-auto overscroll-contain px-1 py-1 sm:grid-cols-3"
          >
            {visible.map((player) => {
              const checked = player.id === selectedId
              return (
                <button
                  key={player.id}
                  type="button"
                  aria-pressed={checked}
                  disabled={claim.isPending}
                  onClick={() => setSelectedId(player.id)}
                  className={cn(
                    "group relative flex min-h-14 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-[color,background-color,border-color,box-shadow] outline-none focus-visible:ring-3 focus-visible:ring-ring/45 disabled:opacity-60",
                    checked
                      ? "border-[var(--color-gold)] bg-[var(--color-gold)]/12 shadow-glow-gold"
                      : "border-[var(--color-gold)]/15 bg-[var(--color-navy)]/55 hover:border-[var(--color-gold)]/45"
                  )}
                >
                  <span
                    className={cn(
                      "grid size-8 shrink-0 place-items-center rounded-full font-display text-sm font-bold",
                      checked
                        ? "bg-[var(--color-gold)] text-[var(--color-navy)]"
                        : "bg-[var(--color-navy-lighter)] text-[var(--color-gold-light)]/80"
                    )}
                  >
                    {checked ? <CheckIcon className="size-4" aria-hidden /> : initialOf(player.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-[var(--color-gold-light)]">{player.name}</span>
                    <span className="block text-[11px] text-muted-foreground tabular-nums">
                      {player.games_played > 0 ? `${player.wins}W ${player.losses}L` : "No games yet"}
                    </span>
                  </span>
                </button>
              )
            })}
            {visible.length === 0 && (
              <p className="col-span-full py-4 text-center text-sm text-muted-foreground">No unclaimed player matches that name.</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" size="lg" onClick={() => handleOpenChange(false)}>
            Not now
          </Button>
          <Button
            variant="royal"
            size="lg"
            disabled={!selected || claim.isPending}
            onClick={() => selected && claim.mutate(selected)}
          >
            {claim.isPending && <Loader2Icon className="animate-spin" />}
            {selected ? `Claim ${selected.name}` : "Pick your name"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
