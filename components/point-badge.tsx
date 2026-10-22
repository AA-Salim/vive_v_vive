"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { CoinsIcon } from "lucide-react"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { cn } from "@/lib/utils"

interface PointBadgeProps {
  balance: number
  className?: string
}

interface Delta {
  id: number
  amount: number
}

const formatter = new Intl.NumberFormat("en-US")

// Live purse: counts to the new balance and floats the change under the badge.
export function PointBadge({ balance, className }: PointBadgeProps) {
  const reduce = useReducedMotion()
  const [tracked, setTracked] = useState<{ balance: number; delta: Delta | null }>({ balance, delta: null })

  if (tracked.balance !== balance) {
    setTracked({ balance, delta: { id: (tracked.delta?.id ?? 0) + 1, amount: balance - tracked.balance } })
  }

  const delta = tracked.delta
  useEffect(() => {
    if (!delta) return
    const timer = setTimeout(() => setTracked((current) => (current.delta?.id === delta.id ? { ...current, delta: null } : current)), 2400)
    return () => clearTimeout(timer)
  }, [delta])

  const inDebt = balance < 0
  const label = `Your purse: ${formatter.format(balance)} points${inDebt ? ", in debt" : ""}. Open your profile`

  return (
    <Link
      href="/profile"
      aria-label={label}
      className={cn(
        "group relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-sm font-semibold sm:px-3 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/45",
        inDebt
          ? "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10 text-[var(--color-danger)] hover:border-[var(--color-danger)]/60"
          : "border-[var(--color-gold)]/25 bg-[var(--color-navy)]/60 text-[var(--color-gold-light)] hover:border-[var(--color-gold)]/55 hover:bg-[var(--color-gold)]/10",
        className
      )}
    >
      {delta && !reduce && (
        <motion.span
          key={delta.id}
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-full ring-2",
            delta.amount > 0 ? "ring-[var(--color-gold)]" : "ring-[var(--color-danger)]"
          )}
          initial={{ opacity: 0.9, scale: 1 }}
          animate={{ opacity: 0, scale: 1.18 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
        />
      )}
      <CoinsIcon
        className={cn("size-4 shrink-0", inDebt ? "text-[var(--color-danger)]" : "text-[var(--color-gold)]")}
        aria-hidden
      />
      <AnimatedNumber value={balance} />
      {inDebt && <span className="hidden text-[10px] font-semibold tracking-[0.14em] uppercase sm:inline">debt</span>}
      <AnimatePresence>
        {delta && (
          <motion.span
            key={delta.id}
            aria-hidden
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.9 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "pointer-events-none absolute top-full right-1 z-10 mt-1.5 rounded-full border px-2 py-0.5 text-xs font-bold tabular-nums shadow-popover",
              delta.amount > 0
                ? "border-[var(--color-success)]/40 bg-[var(--color-surface-overlay)] text-[var(--color-success)]"
                : "border-[var(--color-danger)]/40 bg-[var(--color-surface-overlay)] text-[var(--color-danger)]"
            )}
          >
            {delta.amount > 0 ? "+" : ""}
            {formatter.format(delta.amount)}
          </motion.span>
        )}
      </AnimatePresence>
    </Link>
  )
}
