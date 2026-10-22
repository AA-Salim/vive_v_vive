"use client"

import { HourglassIcon, PlusIcon, SkullIcon, SparklesIcon } from "lucide-react"
import { CATEGORY_ICON, RARITY_BADGE, RARITY_TEXT, iconKeyFor } from "@/components/titles/title-visuals"
import { InfoTip } from "@/components/ui/info-tip"
import { PROFILE_HELP, titleHelp } from "@/lib/profiles/help"
import { groupByTier, LOADOUT_CAPACITY, LOADOUT_TIERS, type TierSpec } from "@/lib/profiles/loadout"
import type { LoadoutTitle, ProfileCurse, ProfileTitles } from "@/lib/profiles/types"
import { RARITY_LABEL } from "@/lib/titles/catalog"
import { cn } from "@/lib/utils"

const TIER_ACCENT: Record<TierSpec["tier"], string> = {
  super: "text-[var(--color-gold)]",
  bronze: "text-amber-500/90",
  basic: "text-[var(--color-gold-light)]/60",
}

const TIER_COLUMNS: Record<TierSpec["tier"], string> = {
  super: "grid-cols-2",
  bronze: "grid-cols-3",
  basic: "grid-cols-4",
}

// Perk text needs room: on phones the detailed rows wrap to two columns.
const DETAILED_COLUMNS: Record<TierSpec["tier"], string> = {
  super: "grid-cols-2",
  bronze: "grid-cols-2 sm:grid-cols-3",
  basic: "grid-cols-2 sm:grid-cols-4",
}

interface TitleSlotProps {
  title: LoadoutTitle
  tier: TierSpec
  detailed: boolean
  // Bronze and basic rows each hold a single rarity, so only mixed slots spell it out.
  showRarity: boolean
}

function TitleSlot({ title, tier, detailed, showRarity }: TitleSlotProps) {
  const Icon = CATEGORY_ICON[iconKeyFor(title.category, title.rarity)]
  const lines = [...new Set([title.effect, title.perk].filter((line): line is string => !!line))]
  return (
    <li className="min-w-0">
      <InfoTip
        help={titleHelp(title, tier)}
        side="top"
        className={cn(
          "flex size-auto h-full min-h-16 w-full flex-col items-start justify-start gap-1 rounded-xl border p-2 text-left before:inset-0 hover:brightness-125",
          RARITY_BADGE[title.rarity]
        )}
      >
        <span className="flex w-full items-center justify-between gap-1">
          <Icon aria-hidden className={cn("size-4 shrink-0", RARITY_TEXT[title.rarity])} />
          {showRarity ? (
            <span className={cn("truncate text-[9px] font-semibold tracking-[0.14em] uppercase", RARITY_TEXT[title.rarity])}>
              {RARITY_LABEL[title.rarity]}
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 w-full text-[11px] leading-tight font-semibold break-words sm:text-xs">{title.name}</span>
        {detailed
          ? lines.map((line, i) => (
              <span
                key={line}
                className={cn(
                  "line-clamp-3 w-full text-[11px] leading-snug font-normal",
                  i === 0 ? "text-[var(--color-gold-light)]/70" : "text-emerald-200/80"
                )}
              >
                {line}
              </span>
            ))
          : null}
      </InfoTip>
    </li>
  )
}

function EmptySlot({ tier }: { tier: TierSpec }) {
  return (
    <li
      className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--color-gold)]/15 bg-[var(--color-navy)]/40 p-2 text-center text-muted-foreground/70"
      aria-label={`Empty ${tier.label.toLowerCase()} slot`}
    >
      <PlusIcon aria-hidden className="size-3.5" />
      <span className="text-[10px] leading-none">Empty</span>
    </li>
  )
}

function SingleBanner({ title }: { title: LoadoutTitle | undefined }) {
  if (!title) {
    return (
      <div className="flex min-h-16 items-center gap-3 rounded-xl border border-dashed border-[var(--color-gold)]/20 bg-[var(--color-navy)]/40 px-3 py-3">
        <PlusIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No banner raised. Walks into battle as a commoner, bold choice.</p>
      </div>
    )
  }
  const tier = LOADOUT_TIERS.find((t) => t.tier === title.tier) ?? LOADOUT_TIERS[LOADOUT_TIERS.length - 1]
  return (
    <ul className="grid grid-cols-1">
      <TitleSlot title={title} tier={tier} detailed showRarity />
    </ul>
  )
}

export function CurseMarks({ curses, heading = true, className }: { curses: ProfileCurse[]; heading?: boolean; className?: string }) {
  if (curses.length === 0) return null
  return (
    <div className={cn("space-y-2", className)}>
      {heading ? (
        <p className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] text-rose-300/90 uppercase">
          <SkullIcon aria-hidden className="size-3.5" />
          Marks of shame
          <InfoTip help={PROFILE_HELP.curses} />
        </p>
      ) : null}
      <ul className="space-y-1.5">
        {curses.map((curse) => (
          <li
            key={curse.name}
            className="flex min-w-0 items-start gap-2.5 rounded-xl border border-dashed border-rose-500/40 bg-rose-500/[0.07] px-3 py-2"
          >
            <SkullIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-rose-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-rose-100">{curse.name}</p>
              {curse.perk ? <p className="text-xs leading-snug text-rose-100/75">{curse.perk}</p> : null}
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-rose-200/70">
                <HourglassIcon aria-hidden className="size-3 shrink-0" />
                {curse.bestowedBy ? `Branded by ${curse.bestowedBy}` : "Branded"}
                {` · ${curse.gamesLeft} game${curse.gamesLeft === 1 ? "" : "s"} left`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

interface TitleLoadoutProps {
  titles: ProfileTitles | null
  linked: boolean
  // Detailed: perk text inside each slot (full page). Otherwise the info bubble carries it.
  detailed?: boolean
  showCurses?: boolean
  className?: string
}

export function TitleLoadout({ titles, linked, detailed = false, showCurses = true, className }: TitleLoadoutProps) {
  if (!linked) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No Discord account claims this seat, so no purse and no banners. A ghost with a champion pool.
      </p>
    )
  }
  if (!titles) {
    return <p className={cn("text-sm text-muted-foreground", className)}>The herald lost the banner list. Try again in a moment.</p>
  }

  const filled = titles.loadout.length
  return (
    <div className={cn("space-y-3", className)}>
      {titles.summary ? (
        <p className="flex items-start gap-2 rounded-lg bg-[var(--color-gold)]/[0.06] px-3 py-2 text-xs leading-snug text-[var(--color-gold-light)] ring-1 ring-[var(--color-gold)]/20">
          <SparklesIcon aria-hidden className="mt-px size-3.5 shrink-0 text-[var(--color-gold)]" />
          <span>
            <span className="font-semibold">Build: </span>
            {titles.summary}
          </span>
        </p>
      ) : null}

      {titles.source === "single" ? (
        <SingleBanner title={titles.loadout[0]} />
      ) : (
        <div className="space-y-2.5">
          {groupByTier(titles.loadout).map(({ spec, titles: worn, empty }) => (
            <section key={spec.tier} aria-label={`${spec.label} slots`}>
              <p className="mb-1.5 flex items-baseline justify-between gap-2 text-[10px] font-semibold tracking-[0.18em] uppercase">
                <span className={TIER_ACCENT[spec.tier]}>
                  {spec.label}
                  <span className="ml-1.5 font-normal tracking-normal text-muted-foreground normal-case">{spec.rarities}</span>
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {Math.min(worn.length, spec.slots)}/{spec.slots}
                </span>
              </p>
              <ul className={cn("grid gap-1.5 sm:gap-2", (detailed ? DETAILED_COLUMNS : TIER_COLUMNS)[spec.tier])}>
                {worn.map((title) => (
                  <TitleSlot
                    key={`${title.name}-${title.slot ?? ""}`}
                    title={title}
                    tier={spec}
                    detailed={detailed}
                    showRarity={spec.tier === "super"}
                  />
                ))}
                {Array.from({ length: empty }, (_, i) => (
                  <EmptySlot key={`empty-${i}`} tier={spec} />
                ))}
              </ul>
            </section>
          ))}
          {filled === 0 ? (
            <p className="text-xs text-muted-foreground">All {LOADOUT_CAPACITY} slots empty. Saving up, or saving face.</p>
          ) : null}
        </div>
      )}

      {showCurses ? <CurseMarks curses={titles.curses} /> : null}
    </div>
  )
}
