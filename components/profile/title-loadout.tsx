"use client"

import { CrownIcon, HourglassIcon, PlusIcon, SkullIcon, SparklesIcon, ZapIcon } from "lucide-react"
import { curseHelp, loadoutHelp, loadoutOf } from "@/components/titles/loadout-chips"
import { GamesLeftTag } from "@/components/titles/loadout-parts"
import { CATEGORY_ICON, RARITY_BADGE, RARITY_TEXT, iconKeyFor } from "@/components/titles/title-visuals"
import { InfoTip } from "@/components/ui/info-tip"
import { PROFILE_HELP } from "@/lib/profiles/help"
import { RARITY_LABEL } from "@/lib/titles/catalog"
import { effectSummary } from "@/lib/titles/effects"
import { LOADOUT_SLOTS, MAX_EQUIPPED, SLOT_COUNT, SLOT_HINT, SLOT_LABEL, type LoadoutSlot } from "@/lib/titles/loadout"
import type { CurseBadge, EquippedTitle, LoadoutEntry } from "@/lib/titles/types"
import { cn } from "@/lib/utils"

const SLOT_ACCENT: Record<LoadoutSlot, string> = {
  super_rare: "text-violet-200",
  rare: "text-sky-200",
  common: "text-[var(--color-gold-light)]/70",
}

// Effect lines need room: on phones every tier wraps to two columns, so the 2/3/4 shape still reads.
const SLOT_COLUMNS: Record<LoadoutSlot, string> = {
  super_rare: "grid-cols-2",
  rare: "grid-cols-2 sm:grid-cols-3",
  common: "grid-cols-2 sm:grid-cols-4",
}

// The primary title, "the" epithet worn under a player's name.
export function primaryTitleOf(entry: EquippedTitle | null | undefined): LoadoutEntry | null {
  if (!entry) return null
  const loadout = loadoutOf(entry)
  return loadout.find((t) => t.primary) ?? loadout[0] ?? null
}

interface TitleEpithetProps {
  entry: EquippedTitle | null | undefined
  size?: "md" | "lg"
  className?: string
}

export function TitleEpithet({ entry, size = "lg", className }: TitleEpithetProps) {
  const primary = primaryTitleOf(entry)
  if (!primary) return null
  const Icon = CATEGORY_ICON[iconKeyFor(primary.category, primary.rarity)]
  return (
    <p
      className={cn(
        "flex min-w-0 items-center gap-1.5 font-display leading-tight font-semibold italic",
        size === "lg" ? "text-lg sm:text-xl" : "text-base",
        RARITY_TEXT[primary.rarity],
        className
      )}
    >
      <Icon aria-hidden className={cn("shrink-0", size === "lg" ? "size-4 sm:size-5" : "size-4")} />
      <span className="sr-only">Known as </span>
      <span className="truncate">{primary.title}</span>
    </p>
  )
}

function TitleSlot({ title, showRarity }: { title: LoadoutEntry; showRarity: boolean }) {
  const Icon = CATEGORY_ICON[iconKeyFor(title.category, title.rarity)]
  const effect = title.effect ?? (title.category === "mockery" ? null : effectSummary(title.title))
  return (
    <li className="min-w-0">
      <InfoTip
        help={loadoutHelp(title)}
        side="top"
        className={cn(
          "flex size-auto h-full min-h-16 w-full flex-col items-start justify-start gap-1 rounded-xl border p-2 text-left before:inset-0 hover:brightness-125",
          RARITY_BADGE[title.rarity]
        )}
      >
        <span className="flex w-full items-center justify-between gap-1">
          <Icon aria-hidden className={cn("size-4 shrink-0", RARITY_TEXT[title.rarity])} />
          {title.primary ? (
            <CrownIcon aria-label="Primary title" className="size-3.5 shrink-0 text-[var(--color-gold)]" />
          ) : showRarity ? (
            <span className={cn("truncate text-[9px] font-semibold tracking-[0.14em] uppercase", RARITY_TEXT[title.rarity])}>
              {RARITY_LABEL[title.rarity]}
            </span>
          ) : null}
        </span>
        <span className="line-clamp-2 w-full text-[11px] leading-tight font-semibold break-words sm:text-xs">{title.title}</span>
        <span className="flex w-full gap-1 text-[11px] leading-snug font-normal text-[var(--color-gold-light)]/75">
          <ZapIcon aria-hidden className="mt-px size-3 shrink-0 text-[var(--color-gold)]" />
          <span className="line-clamp-3">{effect ?? "No immediate effect: its perk pays after the game."}</span>
        </span>
        <GamesLeftTag gamesLeft={title.gamesLeft} />
      </InfoTip>
    </li>
  )
}

function EmptySlot({ slot, onAdd, disabled }: { slot: LoadoutSlot; onAdd?: () => void; disabled: boolean }) {
  const classes =
    "flex h-full min-h-16 w-full min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--color-gold)]/20 bg-[var(--color-navy)]/40 p-2 text-center text-[11px] text-muted-foreground/80"
  const label = `Empty ${SLOT_LABEL[slot].toLowerCase()} slot`
  if (!onAdd) {
    return (
      <li className={classes} aria-label={label}>
        <PlusIcon aria-hidden className="size-3.5 opacity-60" />
        Empty slot
      </li>
    )
  }
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        aria-label={`${label}: open the loadout editor`}
        className={cn(
          classes,
          "transition-colors outline-none hover:border-[var(--color-gold)]/50 hover:bg-[var(--color-gold)]/[0.06] hover:text-[var(--color-gold-light)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60 disabled:pointer-events-none disabled:opacity-50"
        )}
      >
        <PlusIcon aria-hidden className="size-4 text-[var(--color-gold)]/80" />
        Empty slot
      </button>
    </li>
  )
}

const curseClock = (curse: CurseBadge) =>
  `${curse.bestowedBy ? `Branded by ${curse.bestowedBy} · ` : "Branded · "}${curse.gamesLeft} game${curse.gamesLeft === 1 ? "" : "s"} left`

export function CurseMarks({ curses, heading = true, className }: { curses: CurseBadge[]; heading?: boolean; className?: string }) {
  if (curses.length === 0) return null
  return (
    <section aria-label="Marks of shame" className={cn("space-y-2", className)}>
      {heading ? (
        <p className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] text-rose-300/90 uppercase">
          <SkullIcon aria-hidden className="size-3.5" />
          Marks of shame · no slot
          <InfoTip help={PROFILE_HELP.curses} />
        </p>
      ) : null}
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {curses.map((curse) => (
          <li
            key={curse.title}
            className="flex min-w-0 items-start gap-2.5 rounded-xl border border-dashed border-rose-500/40 bg-rose-500/[0.07] px-3 py-2"
          >
            <SkullIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-rose-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-rose-100">{curse.title}</p>
              <p className="text-xs leading-snug text-rose-100/80">{curse.effect ?? curse.perk ?? "Bites after each game."}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-rose-200/70">
                <HourglassIcon aria-hidden className="size-3 shrink-0" />
                {curseClock(curse)}
              </p>
            </div>
            <InfoTip help={curseHelp(curse)} align="end" />
          </li>
        ))}
      </ul>
    </section>
  )
}

interface TitleLoadoutProps {
  entry: EquippedTitle | null | undefined
  // A Discord account claims the seat. Without one there is no purse and no banner.
  linked: boolean
  // Your own loadout: empty slots open the editor.
  onEmpty?: (slot: LoadoutSlot) => void
  disabled?: boolean
  showCurses?: boolean
  className?: string
}

// The full 2/3/4 loadout by slot tier, every slot with its effect line, empty ones as placeholders. Curses apart.
export function TitleLoadout({ entry, linked, onEmpty, disabled = false, showCurses = true, className }: TitleLoadoutProps) {
  if (!linked) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No Discord account claims this seat, so no purse and no banners. A ghost with a champion pool.
      </p>
    )
  }

  const loadout = entry ? loadoutOf(entry) : []
  const curses = entry?.curses ?? []
  return (
    <div className={cn("space-y-3", className)}>
      <div className="space-y-2.5">
        {LOADOUT_SLOTS.map((slot) => {
          const worn = loadout.filter((t) => t.slot === slot)
          const empty = Math.max(0, SLOT_COUNT[slot] - worn.length)
          return (
            <section key={slot} aria-label={`${SLOT_LABEL[slot]} slots`}>
              <p className="mb-1.5 flex items-baseline justify-between gap-2 text-[10px] font-semibold tracking-[0.18em] uppercase">
                <span className={cn("min-w-0 truncate", SLOT_ACCENT[slot])}>
                  {SLOT_LABEL[slot]}
                  <span className="ml-1.5 font-normal tracking-normal text-muted-foreground normal-case">{SLOT_HINT[slot]}</span>
                </span>
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {Math.min(worn.length, SLOT_COUNT[slot])}/{SLOT_COUNT[slot]}
                </span>
              </p>
              <ul className={cn("grid gap-1.5 sm:gap-2", SLOT_COLUMNS[slot])}>
                {worn.map((title) => (
                  <TitleSlot key={title.title} title={title} showRarity={slot === "super_rare"} />
                ))}
                {Array.from({ length: empty }, (_, i) => (
                  <EmptySlot key={`empty-${i}`} slot={slot} disabled={disabled} onAdd={onEmpty ? () => onEmpty(slot) : undefined} />
                ))}
              </ul>
            </section>
          )
        })}
        {loadout.length === 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SparklesIcon aria-hidden className="size-3.5 shrink-0 text-[var(--color-gold)]/60" />
            All {MAX_EQUIPPED} slots empty. Saving up, or saving face.
          </p>
        ) : null}
      </div>

      {showCurses ? <CurseMarks curses={curses} /> : null}
    </div>
  )
}
