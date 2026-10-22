"use client"

import { useMemo, useState } from "react"
import { LaneIcon } from "@/components/lane-icon"
import { ChampionIcon } from "@/components/pages/avatars"
import { SearchField } from "@/components/pages/controls"
import { ALL_ROLES, ROLE_LABELS } from "@/lib/champions"
import type { PoolChampion } from "@/lib/pages/types"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"

interface PoolBoardProps {
  pools: Record<Role, PoolChampion[]>
  dealt: Map<string, number>
}

export function PoolBoard({ pools, dealt }: PoolBoardProps) {
  const [role, setRole] = useState<Role>("top")
  const [search, setSearch] = useState("")

  const list = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return [...(pools[role] ?? [])]
      .filter((c) => !needle || c.name.toLowerCase().includes(needle))
      .sort((x, y) => x.name.localeCompare(y.name))
  }, [pools, role, search])

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Lane pool" className="grid grid-cols-5 gap-1 rounded-xl border border-[var(--color-gold)]/20 bg-[var(--color-navy)]/60 p-1 sm:inline-grid">
          {ALL_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              role="tab"
              aria-selected={role === r}
              onClick={() => setRole(r)}
              className={cn(
                "flex h-10 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-[11px] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm",
                role === r ? "bg-[var(--color-gold)] text-[var(--color-navy)]" : "text-[var(--color-gold-light)]/70 hover:text-[var(--color-gold-light)]"
              )}
            >
              <LaneIcon lane={r} size={14} />
              <span className="truncate">{ROLE_LABELS[r]}</span>
            </button>
          ))}
        </div>
        <SearchField value={search} onChange={setSearch} placeholder={`Search ${ROLE_LABELS[role]}`} label={`Search the ${ROLE_LABELS[role]} pool`} className="sm:w-56" />
      </div>

      <p className="text-xs text-muted-foreground">
        {list.length} {list.length === 1 ? "champion" : "champions"} the randomizer can deal in {ROLE_LABELS[role]}. Grey ones have never been dealt.
      </p>

      {list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--color-gold)]/20 p-6 text-center text-sm text-muted-foreground">No champion by that name in this pool.</p>
      ) : (
        <ul className="grid grid-cols-4 gap-2 min-[420px]:grid-cols-5 sm:grid-cols-7 md:grid-cols-8 lg:grid-cols-10" role="tabpanel" aria-label={`${ROLE_LABELS[role]} pool`}>
          {list.map((c) => {
            const games = dealt.get(c.name) ?? 0
            return (
              <li key={`${role}-${c.internal}`} className="flex min-w-0 flex-col items-center gap-1 text-center" title={`${c.name}: dealt ${games} times`}>
                <ChampionIcon name={c.name} internal={c.internal} size={56} dimmed={games === 0} className="size-12 sm:size-14" />
                <span className="w-full truncate text-[11px] text-[var(--color-gold-light)]/85">{c.name}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">{games > 0 ? `${games}x` : "fresh"}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
