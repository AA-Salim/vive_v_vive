"use client"

import { InfoTip } from "@/components/ui/info-tip"
import { MARK_ICON } from "@/components/titles/marks"
import { CATEGORY_ICON, iconKeyFor } from "@/components/titles/title-visuals"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import type { HelpEntry } from "@/lib/help"
import { perkInfo } from "@/lib/titles/catalog"
import { bannerOf, cursesOf, markFor } from "@/lib/titles/flair"
import { titleHelp } from "@/lib/titles/help"
import { reachNote, reachOf, type PlayContext } from "@/lib/titles/in-play"
import { perkFor } from "@/lib/titles/perks"
import type { EquippedTitle } from "@/lib/titles/types"
import { cn } from "@/lib/utils"

interface InPlayRow {
  key: string
  kind: "perk" | "curse"
  title: string
  kicker: string
  summary: string
  note: string
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  help: HelpEntry
}

function rowsFor(entry: EquippedTitle | undefined, context: PlayContext): InPlayRow[] {
  const rows: InPlayRow[] = []
  const banner = bannerOf(entry)
  const bannerDef = banner ? perkFor(banner.title, banner.category) : null
  if (banner && bannerDef?.kind === "perk") {
    const note = reachNote(reachOf(bannerDef, context), context, "perk")
    const perk = perkInfo(banner.title, banner.category)
    if (note && perk) {
      rows.push({
        key: `banner-${banner.title}`,
        kind: "perk",
        title: banner.title,
        kicker: "Your banner",
        summary: perk.summary,
        note,
        icon: CATEGORY_ICON[iconKeyFor(banner.category, banner.rarity)],
        help: titleHelp({ name: banner.title, category: banner.category, perk, price: banner.price }),
      })
    }
  }
  for (const curse of cursesOf(entry)) {
    const def = perkFor(curse.title, "mockery")
    const note = def ? reachNote(reachOf(def, context), context, "curse") : null
    if (!note) continue
    const to = curse.bestowedBy ?? "whoever branded you"
    rows.push({
      key: `curse-${curse.title}`,
      kind: "curse",
      title: curse.title,
      kicker: `Brand · ${curse.gamesLeft} game${curse.gamesLeft === 1 ? "" : "s"} left`,
      summary: curse.perk || (perkInfo(curse.title, "mockery", to)?.summary ?? ""),
      note,
      icon: MARK_ICON[markFor(curse.title)],
      help: titleHelp({
        name: curse.title,
        category: "mockery",
        perk: perkInfo(curse.title, "mockery", to),
        price: curse.price,
        wearer: "you",
        curse: { bestowedBy: curse.bestowedBy, gamesLeft: curse.gamesLeft, dignityCost: curse.dignityCost },
      }),
    })
  }
  return rows
}

interface TitleInPlayProps {
  userId: string | null | undefined
  context: PlayContext
  className?: string
}

// The viewer's own banner and brands, shown where an action feeds them (bet slip, decree board, duel sheet).
export function TitleInPlay({ userId, context, className }: TitleInPlayProps) {
  const { byUserId } = useEquippedTitles()
  const rows = rowsFor(userId ? byUserId.get(userId) : undefined, context)
  if (rows.length === 0) return null

  return (
    <ul className={cn("space-y-1.5", className)} aria-label="Your titles in play">
      {rows.map((row) => {
        const Icon = row.icon
        const curse = row.kind === "curse"
        return (
          <li
            key={row.key}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border px-2.5 py-2",
              curse ? "border-rose-500/30 bg-rose-500/[0.07]" : "border-[var(--color-gold)]/25 bg-[var(--color-gold)]/[0.06]"
            )}
          >
            <Icon aria-hidden className={cn("mt-0.5 size-4 shrink-0", curse ? "text-rose-300" : "text-[var(--color-gold)]")} />
            <div className="min-w-0 flex-1">
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-[10px] font-semibold tracking-wider uppercase">
                <span className={cn("min-w-0 truncate", curse ? "text-rose-100" : "text-[var(--color-gold-light)]")}>{row.title}</span>
                <span className="text-muted-foreground">{row.kicker}</span>
              </p>
              <p className={cn("text-xs leading-snug", curse ? "text-rose-100/90" : "text-[var(--color-gold-light)]/90")}>{row.summary}</p>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{row.note}</p>
            </div>
            <InfoTip help={row.help} side="top" align="end" className="-mr-0.5" />
          </li>
        )
      })}
    </ul>
  )
}
