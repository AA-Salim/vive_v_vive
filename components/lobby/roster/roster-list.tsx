"use client"

import { SearchIcon, XIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { RosterRow } from "@/components/lobby/roster/roster-row"
import type { PlayerIntent } from "@/components/lobby/roster/player-admin-menu"
import type { RosterPlayer } from "@/lib/lobby/types"
import { cn } from "@/lib/utils"

export function matchesSearch(name: string, search: string): boolean {
  const normalize = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase()
  return normalize(name).includes(normalize(search.trim()))
}

export function RosterSearch({
  value,
  onChange,
  id,
  placeholder = "Search the roster",
}: {
  value: string
  onChange: (value: string) => void
  id: string
  placeholder?: string
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="h-11 rounded-xl pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-0.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}

interface RosterListProps {
  players: RosterPlayer[]
  benched: RosterPlayer[]
  selectedIds: Set<string>
  full: boolean
  meId: string | null
  queuePositions: Map<string, number>
  isAdmin: boolean
  now: number
  search: string
  columns?: boolean
  onToggle: (player: RosterPlayer) => void
  onIntent: (intent: PlayerIntent, player: RosterPlayer) => void
}

export function RosterList({
  players,
  benched,
  selectedIds,
  full,
  meId,
  queuePositions,
  isAdmin,
  now,
  search,
  columns = false,
  onToggle,
  onIntent,
}: RosterListProps) {
  const visible = players.filter((p) => matchesSearch(p.name, search))
  const visibleBenched = benched.filter((p) => matchesSearch(p.name, search))
  const row = (player: RosterPlayer) => (
    <RosterRow
      key={player.id}
      player={player}
      selected={selectedIds.has(player.id)}
      full={full}
      isMe={player.id === meId}
      queuePosition={queuePositions.get(player.id) ?? null}
      isAdmin={isAdmin}
      now={now}
      onToggle={onToggle}
      onIntent={onIntent}
    />
  )

  return (
    <div className="flex flex-col gap-3">
      {visible.length === 0 && visibleBenched.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {search ? `Nobody called "${search.trim()}" on the roster.` : "The roster is empty. The Rift echoes."}
        </p>
      ) : (
        <ul className={cn("grid gap-1.5", columns && "sm:grid-cols-2")} aria-label="Active players">
          {visible.map(row)}
        </ul>
      )}
      {visibleBenched.length > 0 && (
        <section aria-label="Benched players" className="flex flex-col gap-1.5">
          <h3 className="px-1 pt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Benched · {visibleBenched.length}
          </h3>
          <ul className={cn("grid gap-1.5", columns && "sm:grid-cols-2")}>{visibleBenched.map(row)}</ul>
        </section>
      )}
    </div>
  )
}
