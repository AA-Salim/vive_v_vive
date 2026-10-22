"use client"

import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { motion, useReducedMotion } from "motion/react"
import { ArrowRight, HandCoins, Loader2, Sparkles } from "lucide-react"
import { InfoTip } from "@/components/ui/info-tip"
import { AnimatedNumber } from "@/components/titles/animated-number"
import { MARK_ICON } from "@/components/titles/marks"
import { CATEGORY_ICON, iconKeyFor } from "@/components/titles/title-visuals"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import { FREE, pts, type HelpEntry } from "@/lib/help"
import { perkInfo } from "@/lib/titles/catalog"
import { bannerOf, markFor } from "@/lib/titles/flair"
import { involvement } from "@/lib/titles/help"
import { PERK_CAP } from "@/lib/titles/rules"
import { signed } from "@/lib/titles/copy"
import type { TitlePayoutItem, TitlePayoutsResponse } from "@/lib/titles/types"
import { cn } from "@/lib/utils"

const PAYOUT_HELP: HelpEntry = {
  title: "Your titles this game",
  does: "What your banner paid, what your brands took, and the tribute you collected from the people you branded.",
  cost: FREE,
  reward: `A banner pays up to ${pts(PERK_CAP)} a game, and every brand you bestowed pays you its tribute`,
  limits: `Settles a few seconds after the result, only for games where ${involvement("you")}.`,
}

const TALLY_WINDOW_MS = 45_000

export function titlePayoutsKey(sessionId: string, userId: string | null) {
  return ["titles", "payouts", sessionId, userId ?? "anonymous"] as const
}

async function fetchPayouts(sessionId: string): Promise<TitlePayoutsResponse> {
  const res = await fetch(`/api/titles/payouts?${new URLSearchParams({ sessionId })}`, { cache: "no-store" })
  if (!res.ok) throw new Error(`GET /api/titles/payouts failed with ${res.status}`)
  return res.json()
}

function ItemIcon({ item }: { item: TitlePayoutItem }) {
  if (item.kind === "tribute") return <HandCoins aria-hidden className="size-4 shrink-0 text-[var(--color-gold)]" />
  if (item.kind === "curse") {
    const Icon = MARK_ICON[markFor(item.title ?? "")]
    return <Icon aria-hidden className="size-4 shrink-0 text-rose-300" />
  }
  return <Sparkles aria-hidden className="size-4 shrink-0 text-emerald-300" />
}

function itemLabel(item: TitlePayoutItem): string {
  if (item.kind === "tribute") return item.counterpart ? `Tribute from ${item.counterpart}` : "Tribute"
  return item.title ?? (item.kind === "curse" ? "Brand" : "Title perk")
}

interface TitlePayoutProps {
  sessionId: string
  userId: string | null
  // Milliseconds since the result landed, to tell "still tallying" from "paid nothing".
  sinceResultMs: number | null
}

// The personal line of the result screen: what wearing a title was worth this game.
export function TitlePayout({ sessionId, userId, sinceResultMs }: TitlePayoutProps) {
  const reduced = useReducedMotion()
  const { byUserId } = useEquippedTitles()
  const tallying = sinceResultMs !== null && sinceResultMs < TALLY_WINDOW_MS
  const query = useQuery({
    queryKey: titlePayoutsKey(sessionId, userId),
    queryFn: () => fetchPayouts(sessionId),
    enabled: !!userId,
    staleTime: 15_000,
    refetchInterval: (q) => (tallying && (q.state.data?.items.length ?? 0) === 0 ? 6_000 : false),
  })

  if (!userId) return null
  const entry = byUserId.get(userId)
  const banner = bannerOf(entry)
  const items = query.data?.items ?? []
  const total = query.data?.total ?? 0
  const BannerIcon = banner ? CATEGORY_ICON[iconKeyFor(banner.category, banner.rarity)] : null

  if (query.isError && items.length === 0) return null
  if (!entry && items.length === 0 && !query.isPending) {
    return (
      <Link
        href="/titles"
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[var(--color-gold)]/20 px-3 text-xs text-[var(--color-gold-light)]/80 transition-colors hover:bg-[var(--color-gold)]/10"
      >
        No banner raised. A title pays out after every game you take part in.
        <ArrowRight aria-hidden className="size-3.5 shrink-0" />
      </Link>
    )
  }

  return (
    <motion.section
      aria-label="Your titles this game"
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.35 }}
      className="w-full max-w-md rounded-xl border border-[var(--color-gold)]/25 bg-[var(--color-navy)]/70 p-3 text-left"
    >
      <header className="flex items-center gap-2">
        {BannerIcon ? <BannerIcon aria-hidden className="size-4 shrink-0 text-[var(--color-gold)]" /> : null}
        <p className="min-w-0 flex-1 truncate text-[10px] font-bold tracking-[0.18em] text-[var(--color-gold)]/80 uppercase">
          {banner ? `${banner.title} this game` : "Your titles this game"}
        </p>
        {items.length > 0 && (
          <AnimatedNumber
            value={total}
            signed
            className={cn("font-display text-lg leading-none", total < 0 ? "text-rose-300" : "text-[var(--color-gold-light)]")}
          />
        )}
        <InfoTip help={PAYOUT_HELP} side="top" align="end" />
      </header>

      {items.length > 0 ? (
        <ul className="mt-2 divide-y divide-border/50">
          {items.map((item, index) => (
            <motion.li
              key={item.id}
              initial={reduced ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.65 + index * 0.08 }}
              className="flex items-center gap-2.5 py-1.5"
            >
              <ItemIcon item={item} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-[var(--color-gold-light)]/90">{itemLabel(item)}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {item.detail}
                  {item.kind === "curse" && item.counterpart ? ` · paid to ${item.counterpart}` : ""}
                </p>
              </div>
              <span className={cn("shrink-0 text-sm font-semibold tabular-nums", item.amount < 0 ? "text-rose-300" : "text-emerald-300")}>
                {signed(item.amount)}
              </span>
            </motion.li>
          ))}
        </ul>
      ) : query.isPending || tallying ? (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 aria-hidden className="size-3.5 animate-spin" />
          The herald is tallying what your titles earned...
        </p>
      ) : (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {banner
            ? `Quiet game for your banner. ${perkInfo(banner.title, banner.category)?.summary ?? "It carries no perk, only prestige."}`
            : "Your brands took nothing this game."}
        </p>
      )}
    </motion.section>
  )
}
