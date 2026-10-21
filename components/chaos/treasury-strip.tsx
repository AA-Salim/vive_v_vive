"use client"

import type { ReactNode } from "react"
import { CoinsIcon, HandCoinsIcon, LogInIcon, ScrollIcon } from "lucide-react"
import { DEBT_FLOOR } from "@/lib/chaos/catalog"
import { sideName } from "@/lib/chaos/rules"
import type { ChaosDecreeEntry } from "@/lib/chaos/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AnimatedNumber } from "@/components/chaos/animated-number"

function Stat({ icon, label, children, hint }: { icon: ReactNode; label: string; children: ReactNode; hint?: string | null }) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--color-navy)]/60 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-gold-light)]/50">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 text-lg font-bold leading-tight">{children}</div>
      {hint && <div className="truncate text-[10px] text-[var(--color-gold-light)]/45">{hint}</div>}
    </div>
  )
}

interface TreasuryStripProps {
  signedIn: boolean
  balance: number | null
  mine: ChaosDecreeEntry[]
  onSignIn: () => void
}

export function TreasuryStrip({ signedIn, balance, mine, onSignIn }: TreasuryStripProps) {
  if (!signedIn) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border border-[var(--color-gold)]/15 bg-[var(--color-navy)]/60 p-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--color-gold-light)]/70">
          Log in with Discord to issue decrees in the name of the exiled king.
        </p>
        <Button onClick={onSignIn} className="h-10 bg-[var(--color-gold)] px-4 font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]">
          <LogInIcon aria-hidden className="size-4" />
          Log in
        </Button>
      </div>
    )
  }

  const live = mine.filter((a) => a.status !== "refunded")
  const allWagers = live.filter((a) => a.action_type === "double_or_nothing")
  const pending = allWagers.filter((w) => w.status === "pending")
  const won = allWagers.filter((w) => w.status === "won")
  const riding = pending.reduce((sum, w) => sum + w.cost, 0)
  const toWin = pending.reduce((sum, w) => sum + (w.potential_payout ?? w.cost * 2), 0)
  const collected = won.reduce((sum, w) => sum + (w.payout ?? 0), 0)
  const spent = live.reduce((sum, a) => sum + a.cost, 0)
  const wagerSide = allWagers[0]?.side
  const wagerHint =
    pending.length > 0 && wagerSide
      ? `${riding} on ${sideName(wagerSide)}`
      : won.length > 0
        ? "the treasury paid up"
        : allWagers.length > 0
          ? "the treasury thanks you"
          : "none riding"

  return (
    <div role="group" aria-label="Your royal purse" className="grid grid-cols-3 gap-2">
      <Stat
        icon={<CoinsIcon aria-hidden className="size-3" />}
        label="Purse"
        hint={balance != null && balance < 0 ? `Floor ${DEBT_FLOOR}` : "points"}
      >
        {balance == null ? (
          <span className="text-[var(--color-gold-light)]/40">--</span>
        ) : (
          <AnimatedNumber value={balance} className={cn(balance < 0 ? "text-amber-300" : "text-[var(--color-gold)]")} />
        )}
      </Stat>
      <Stat
        icon={<HandCoinsIcon aria-hidden className="size-3" />}
        label="Wagers"
        hint={wagerHint}
      >
        {pending.length > 0 || won.length > 0 ? (
          <span className="text-emerald-300">
            <AnimatedNumber value={pending.length > 0 ? toWin : collected} />
            <span className="ml-1 text-[10px] font-medium text-[var(--color-gold-light)]/45">
              {pending.length > 0 ? "to win" : "won"}
            </span>
          </span>
        ) : (
          <span className="text-[var(--color-gold-light)]/40">0</span>
        )}
      </Stat>
      <Stat
        icon={<ScrollIcon aria-hidden className="size-3" />}
        label="Decrees"
        hint={spent > 0 ? `${spent} spent this game` : "this game"}
      >
        <AnimatedNumber value={live.length} className="text-[var(--color-gold-light)]" />
      </Stat>
    </div>
  )
}

export function TreasuryStripSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2" aria-hidden>
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-[66px] rounded-lg bg-[var(--color-navy-lighter)]/70" />
      ))}
    </div>
  )
}
