"use client"

import type { ProfileScope } from "@/components/profile/use-player-profile"
import type { ProfileSeason } from "@/lib/profiles/types"
import { cn } from "@/lib/utils"

export const shortActName = (season: ProfileSeason) =>
  season.number === null ? "All time" : (season.name.split(":")[0]?.trim() || `Act ${season.number}`)

export function selectedKey(seasons: ProfileSeason[], scope: ProfileScope): ProfileSeason["key"] {
  if (scope !== "current") return scope
  return seasons.find((s) => s.status === "active")?.key ?? "all"
}

interface SeasonPickerProps {
  seasons: ProfileSeason[]
  scope: ProfileScope
  onChange: (scope: ProfileScope) => void
  // Compact: the current act and All time only (quick sheet).
  compact?: boolean
  className?: string
}

export function SeasonPicker({ seasons, scope, onChange, compact = false, className }: SeasonPickerProps) {
  const active = seasons.find((s) => s.status === "active")
  const options = compact ? seasons.filter((s) => s === active || s.key === "all") : seasons
  if (options.length < 2) return null
  const selected = selectedKey(seasons, scope)

  return (
    <div
      role="group"
      aria-label="Season"
      className={cn("flex max-w-full flex-wrap gap-1.5", className)}
    >
      {options.map((season) => {
        const checked = season.key === selected
        const current = season.status === "active"
        return (
          <button
            key={String(season.key)}
            type="button"
            aria-pressed={checked}
            onClick={() => onChange(current ? "current" : season.key)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              checked
                ? "border-[var(--color-gold)]/45 bg-linear-to-b from-[var(--color-gold)]/18 to-[var(--color-gold)]/5 text-[var(--color-gold-light)]"
                : "border-[var(--color-gold)]/15 bg-[var(--color-navy)]/40 text-muted-foreground hover:border-[var(--color-gold)]/30 hover:text-foreground"
            )}
          >
            {shortActName(season)}
            {current ? (
              <span className="rounded bg-emerald-400/15 px-1 py-px text-[9px] font-semibold tracking-wider text-emerald-300 uppercase">Now</span>
            ) : null}
            <span className="text-[11px] text-muted-foreground tabular-nums">{season.games}g</span>
          </button>
        )
      })}
    </div>
  )
}
