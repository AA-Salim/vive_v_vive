"use client"

import { Hourglass } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { HelpRows } from "@/components/ui/info-tip"
import { TitleBadge } from "@/components/title-badge"
import { PerkLine } from "@/components/titles/perk-line"
import { Laurel, MARK_ICON, MARK_LABEL } from "@/components/titles/marks"
import styles from "@/components/titles/flair.module.css"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import { perkInfo } from "@/lib/titles/catalog"
import { bannerOf, cursesOf, epithetFor, flairOf, markFor } from "@/lib/titles/flair"
import { titleHelp } from "@/lib/titles/help"
import type { CurseBadge, EquippedTitle } from "@/lib/titles/types"
import { cn } from "@/lib/utils"

interface PlayerNameProps {
  name: string
  playerId?: string | null
  userId?: string | null
  // Pass the entry when the caller already holds it; null renders a plain name.
  title?: EquippedTitle | null
  epithet?: boolean
  marks?: boolean
  // Opens the title card on hover or tap. Keep it off inside buttons and other popover triggers.
  interactive?: boolean
  // Flows inside a sentence (herald lines) instead of truncating as a single row.
  inline?: boolean
  className?: string
  nameClassName?: string
}

const gamesLeft = (n: number) => `${n} game${n === 1 ? "" : "s"} left`

export function useTitleEntry(playerId?: string | null, userId?: string | null, title?: EquippedTitle | null) {
  const { entryFor } = useEquippedTitles()
  return title !== undefined ? title : entryFor(playerId, userId)
}

export function epithetLine(name: string, entry: EquippedTitle | null | undefined): string {
  const banner = bannerOf(entry)
  const curses = cursesOf(entry)
  const parts = [banner ? `${name} ${epithetFor(banner.title)}` : name]
  for (const curse of curses) parts.push(`branded ${curse.title}, ${gamesLeft(curse.gamesLeft)}`)
  return parts.join(" · ")
}

function CurseMarks({ curses, className }: { curses: CurseBadge[]; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5 align-[-2px] text-rose-300", className)}>
      {curses.map((curse) => {
        const kind = markFor(curse.title)
        const Icon = MARK_ICON[kind]
        return (
          <span key={curse.title} className="inline-flex">
            <Icon aria-hidden className={cn("size-3.5 drop-shadow-[0_0_4px_rgb(244_63_94/0.45)]", kind === "bells" && styles.bells)} />
            <span className="sr-only">
              , wears {MARK_LABEL[kind]}: {curse.title}
              {curse.bestowedBy ? ` from ${curse.bestowedBy}` : ""}
            </span>
          </span>
        )
      })}
    </span>
  )
}

function NameFace({
  name,
  entry,
  epithet,
  marks,
  inline,
  nameClassName,
}: {
  name: string
  entry: EquippedTitle | null | undefined
  epithet: boolean
  marks: boolean
  inline: boolean
  nameClassName?: string
}) {
  const flair = flairOf(entry)
  const banner = bannerOf(entry)
  const curses = cursesOf(entry)
  return (
    <>
      {flair?.tone === "award" && <Laurel aria-hidden className={cn("inline size-3.5 shrink-0 align-[-2px]", styles.laurel)} />}
      <span
        className={cn(
          !inline && (epithet && banner ? "shrink-0" : "min-w-0 truncate"),
          flair && styles[flair.tone],
          flair?.strong && styles.strong,
          nameClassName
        )}
      >
        {name}
      </span>
      {epithet && banner && (
        <span className={cn(styles.epithet, "text-[var(--color-gold-light)]/75", !inline && "min-w-0 truncate")}>
          {inline ? " " : ""}
          {epithetFor(banner.title)}
        </span>
      )}
      {marks && curses.length > 0 && <CurseMarks curses={curses} className={inline ? "ml-1" : undefined} />}
    </>
  )
}

// Just the epithet ("the Kingslayer"), for tight spots where the badges do not fit.
export function Epithet({ playerId, userId, className }: { playerId?: string | null; userId?: string | null; className?: string }) {
  const banner = bannerOf(useTitleEntry(playerId, userId))
  if (!banner) return null
  return <span className={cn("block text-[var(--color-gold-light)]/70", styles.epithet, className)}>{epithetFor(banner.title)}</span>
}

// The whole story of a name: its banner (with what it pays) and every brand burning on it.
export function TitleCard({ name, entry, showName = true }: { name: string; entry: EquippedTitle; showName?: boolean }) {
  const banner = bannerOf(entry)
  const curses = cursesOf(entry)
  const bannerPerk = banner ? perkInfo(banner.title, banner.category) : null

  return (
    <div className="flex max-h-[min(28rem,70dvh)] flex-col gap-3 overflow-y-auto">
      {showName && (
        <p className="font-display text-base leading-tight">
          <NameFace name={name} entry={entry} epithet marks={false} inline />
        </p>
      )}
      {banner ? (
        <div className="space-y-2">
          <TitleBadge name={banner.title} category={banner.category} rarity={banner.rarity} perk={bannerPerk} size="md" />
          <PerkLine perk={bannerPerk} emptyLabel="Pure prestige. This banner carries no perk, only bragging rights." />
          <HelpRows help={titleHelp({ name: banner.title, category: banner.category, perk: bannerPerk, price: banner.price })} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No banner raised. The brands below are all the court sees.</p>
      )}
      {curses.map((curse) => {
        const kind = markFor(curse.title)
        const Icon = MARK_ICON[kind]
        const perk = perkInfo(curse.title, "mockery", curse.bestowedBy ?? "whoever branded them")
        return (
          <div key={curse.title} className="space-y-2 rounded-lg border border-rose-500/25 bg-rose-500/[0.06] p-2.5">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-100">
              <Icon aria-hidden className="size-4 shrink-0 text-rose-300" />
              <span className="min-w-0 truncate">{curse.title}</span>
            </p>
            <p className="flex items-center gap-1.5 text-[11px] text-rose-200/80">
              <Hourglass aria-hidden className="size-3 shrink-0" />
              {curse.bestowedBy ? `Branded by ${curse.bestowedBy}` : "Branded"} · {gamesLeft(curse.gamesLeft)}
            </p>
            <HelpRows
              help={titleHelp({
                name: curse.title,
                category: "mockery",
                perk,
                price: curse.price,
                wearer: name,
                curse: { bestowedBy: curse.bestowedBy, gamesLeft: curse.gamesLeft, dignityCost: curse.dignityCost },
              })}
            />
          </div>
        )
      })}
    </div>
  )
}

// A player's name dressed in their banner's colors, with the brands they bear. One shared
// equipped-titles query feeds every instance.
export function PlayerName({
  name,
  playerId,
  userId,
  title,
  epithet = false,
  marks = true,
  interactive = false,
  inline = false,
  className,
  nameClassName,
}: PlayerNameProps) {
  const entry = useTitleEntry(playerId, userId, title)
  const layout = inline ? "inline" : "inline-flex min-w-0 max-w-full items-center gap-1"
  const face = <NameFace name={name} entry={entry} epithet={epithet} marks={marks} inline={inline} nameClassName={nameClassName} />

  if (!entry) return <span className={cn(layout, className)}>{name}</span>

  if (!interactive) {
    return (
      <span className={cn(layout, styles.trigger, className)} title={epithetLine(name, entry)}>
        {face}
      </span>
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={200}
        nativeButton={false}
        render={<span />}
        aria-label={`${epithetLine(name, entry)}. Show title`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className={cn(
          layout,
          styles.trigger,
          "cursor-help rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60",
          className
        )}
      >
        {face}
      </PopoverTrigger>
      <PopoverContent side="top" sideOffset={6} className="w-80 p-3" onClick={(e) => e.stopPropagation()}>
        <TitleCard name={name} entry={entry} />
      </PopoverContent>
    </Popover>
  )
}
