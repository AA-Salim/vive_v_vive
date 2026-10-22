"use client"

import { useId, useMemo, useState } from "react"
import { RefreshCwIcon, SearchIcon, UsersIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { DuelAvatar } from "@/components/duels/duel-avatar"
import { rivalBlock, rivalBlockLabel, sideOfAccount, type RivalBlock, type RivalContext } from "@/lib/duels/eligibility"
import { SIDE_NAME, otherSide } from "@/lib/duels/rules"
import type { RosterEntry } from "@/lib/duels/types"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

export type RivalChoice = "open" | string

interface RivalPickerProps {
  roster: RosterEntry[] | undefined
  loading: boolean
  failed: boolean
  onRetry: () => void
  value: RivalChoice | null
  onChange: (value: RivalChoice) => void
  ctx: RivalContext
  disabled?: boolean
}

interface Candidate {
  entry: RosterEntry
  side: Side | null
  block: RivalBlock | null
}

const SEARCH_THRESHOLD = 10

function rank(c: Candidate): number {
  if (c.block) return 3
  return c.side ? 0 : 1
}

export function RivalPicker({ roster, loading, failed, onRetry, value, onChange, ctx, disabled = false }: RivalPickerProps) {
  const searchId = useId()
  const [query, setQuery] = useState("")
  const answerSide = otherSide(ctx.side)

  const candidates = useMemo(() => {
    const list: Candidate[] = (roster ?? [])
      .map((entry) => ({
        entry,
        side: sideOfAccount(entry.playerIds, ctx.sideOfPlayer),
        block: rivalBlock(entry, ctx),
      }))
      .filter((c) => c.block !== "self")
    return list.sort((a, b) => rank(a) - rank(b) || a.entry.name.localeCompare(b.entry.name, undefined, { sensitivity: "base" }))
  }, [roster, ctx])

  const needle = query.trim().toLowerCase()
  const visible = needle ? candidates.filter((c) => c.entry.name.toLowerCase().includes(needle)) : candidates

  return (
    <fieldset className="space-y-2.5" disabled={disabled}>
      <legend className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-gold-light)]/80">Your rival</legend>

      <button
        type="button"
        aria-pressed={value === "open"}
        onClick={() => onChange("open")}
        className={cn(
          "flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          value === "open"
            ? "border-[var(--color-gold)] bg-[var(--color-gold)]/12 shadow-[0_0_22px_-10px_var(--color-gold)]"
            : "border-border bg-[var(--color-navy)]/50 hover:border-[var(--color-gold)]/45"
        )}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-dashed border-[var(--color-gold)]/50 text-[var(--color-gold)]">
          <UsersIcon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[var(--color-gold-light)]">Open gauntlet</span>
          <span className="block text-xs text-muted-foreground">
            Anyone can answer by taking {SIDE_NAME[answerSide]}. First come, first fought.
          </span>
        </span>
      </button>

      {candidates.length > SEARCH_THRESHOLD && (
        <div className="relative">
          <label htmlFor={searchId} className="sr-only">
            Search the court
          </label>
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id={searchId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search the court"
            autoComplete="off"
            className="h-10 bg-[var(--color-navy)]/60 pl-9"
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-4" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[5.25rem] rounded-xl" />
          ))}
        </div>
      ) : failed ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-border px-3 py-3">
          <p className="text-xs text-muted-foreground">The court registry would not open.</p>
          <Button variant="outline" onClick={onRetry} className="h-10 gap-1.5 px-3">
            <RefreshCwIcon className="size-4" aria-hidden />
            Retry
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          {needle ? "Nobody by that name. Not even in the notebook." : "Nobody else holds a purse yet."}
        </p>
      ) : (
        <div role="group" aria-label="Pick a named rival" className="grid grid-cols-3 gap-2 min-[400px]:grid-cols-4">
          {visible.map(({ entry, side, block }) => {
            const selected = value === entry.userId
            return (
              <button
                key={entry.userId}
                type="button"
                aria-pressed={selected}
                disabled={!!block}
                onClick={() => onChange(entry.userId)}
                className={cn(
                  "flex h-[5.25rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed",
                  selected
                    ? "border-[var(--color-gold)] bg-[var(--color-gold)]/12 shadow-[0_0_20px_-10px_var(--color-gold)]"
                    : "border-border bg-[var(--color-navy)]/50 hover:border-[var(--color-gold)]/45",
                  block && "opacity-45"
                )}
              >
                <DuelAvatar duelist={entry} side={side} size="sm" />
                <span className="w-full truncate text-center text-xs font-medium text-foreground">{entry.name}</span>
                <span
                  className={cn(
                    "w-full truncate text-center text-[10px] font-semibold uppercase tracking-[0.12em]",
                    block
                      ? "text-muted-foreground"
                      : side === "blue"
                        ? "text-[var(--color-blue-team)]"
                        : side === "red"
                          ? "text-[var(--color-red-team)]"
                          : "text-muted-foreground"
                  )}
                >
                  {block ? rivalBlockLabel(block, ctx.side) : side ? `Plays ${SIDE_NAME[side]}` : "Spectator"}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </fieldset>
  )
}
