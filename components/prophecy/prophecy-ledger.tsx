"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { ChevronDownIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TONES } from "@/components/prophecy/category-meta"
import { wagerProfit } from "@/lib/prophecy/odds"
import type { Candidate, LegacyProphecyView, WagerView } from "@/lib/prophecy/types"
import { cn } from "@/lib/utils"

const COLLAPSED_ROWS = 5

interface ProphecyLedgerProps {
  wagers: WagerView[]
  legacy: LegacyProphecyView[]
  candidates: Candidate[]
  viewerId: string | null
}

export function ProphecyLedger({ wagers, legacy, candidates, viewerId }: ProphecyLedgerProps) {
  const [expanded, setExpanded] = useState(false)
  const names = new Map(candidates.map((c) => [c.playerId, c.name]))
  const total = wagers.length + legacy.length
  if (total === 0) return null
  const visibleWagers = expanded ? wagers : wagers.slice(0, COLLAPSED_ROWS)
  const visibleLegacy = expanded ? legacy : legacy.slice(0, Math.max(0, COLLAPSED_ROWS - visibleWagers.length))

  return (
    <section aria-label="Sealed prophecies" className="space-y-1.5">
      <h4 className="px-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        The ledger · {total} sealed
      </h4>
      <ul className="space-y-1">
        <AnimatePresence initial={false}>
          {visibleWagers.map((wager) => {
            const tone = TONES[wager.market]
            const Icon = tone.icon
            return (
              <motion.li
                key={wager.id}
                layout="position"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-navy)]/60 px-2.5 py-1.5",
                  wager.userId === viewerId && "ring-1 ring-[var(--color-gold)]/30"
                )}
              >
                <Avatar size="sm">
                  {wager.avatarUrl && <AvatarImage src={wager.avatarUrl} alt="" />}
                  <AvatarFallback>{wager.username.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-xs">
                  <span className="font-medium text-foreground">{wager.username}</span>
                  <span className="text-muted-foreground"> called </span>
                  <span className={cn("font-semibold", tone.text)}>
                    {wager.playerId ? names.get(wager.playerId) ?? "someone" : "a vanished player"}
                  </span>
                </span>
                <span
                  className={cn(
                    "flex h-5 shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] font-bold tracking-wider uppercase",
                    tone.chip
                  )}
                >
                  <Icon className="size-3" aria-hidden />
                  {wager.market === "mvp" ? "MVP" : "Inter"}
                </span>
                <Outcome wager={wager} />
              </motion.li>
            )
          })}
        </AnimatePresence>
        {visibleLegacy.map((row) => (
          <li key={row.id} className="flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-navy)]/40 px-2.5 py-1.5 opacity-75">
            <Avatar size="sm">
              {row.avatarUrl && <AvatarImage src={row.avatarUrl} alt="" />}
              <AvatarFallback>{row.username.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{row.username}</span> · retired {row.label}: {row.description}
            </span>
            <span className="shrink-0 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
              {row.correct === true ? "Hit · no payout" : row.correct === false ? "Miss" : "Retired"}
            </span>
          </li>
        ))}
      </ul>
      {total > COLLAPSED_ROWS && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="flex h-10 w-full items-center justify-center gap-1 rounded-lg text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? "Show less" : `Show all ${total}`}
          <ChevronDownIcon className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
      )}
    </section>
  )
}

function Outcome({ wager }: { wager: WagerView }) {
  const base = "w-14 shrink-0 text-right text-xs font-bold tabular-nums"
  if (wager.status === "won") {
    const profit = wagerProfit(wager)
    if (profit <= 0) return <span className={cn(base, "text-muted-foreground")}>Even</span>
    return <span className={cn(base, "text-emerald-300")}>+{profit}</span>
  }
  if (wager.status === "lost") return <span className={cn(base, "text-destructive/80")}>-{wager.stake}</span>
  if (wager.status === "refunded") return <span className={cn(base, "text-muted-foreground")}>{wager.stake} back</span>
  return <span className={cn(base, "text-muted-foreground")}>{wager.stake}</span>
}
