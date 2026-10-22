"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowRightIcon, CoinsIcon, InfoIcon } from "lucide-react"
import { AnimatedNumber } from "@/components/ui/animated-number"
import { HelpRows } from "@/components/ui/info-tip"
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { DEBT_FLOOR, PURSE_HELP } from "@/lib/economy"
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

function debtLine(balance: number): string {
  const room = balance - DEBT_FLOOR
  return room > 0
    ? `You are ${formatter.format(-balance)} in debt. ${formatter.format(room)} more and the purse locks at ${DEBT_FLOOR}.`
    : `You hit the floor of ${DEBT_FLOOR}. Earn your way back up before spending again.`
}

// The bubble sits beside the purse link, never inside it: a tap on it must not navigate.
function PurseInfo({ balance }: { balance: number }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        openOnHover
        delay={120}
        nativeButton={false}
        aria-label="How the points work"
        render={
          <span className="relative mr-1.5 inline-flex size-6 shrink-0 cursor-help items-center justify-center rounded-full text-current opacity-60 transition-opacity outline-none before:absolute before:-inset-y-2 before:-right-2.5 before:-left-1.5 before:content-[''] hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60 data-[popup-open]:opacity-100" />
        }
      >
        <InfoIcon className="size-3.5" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 gap-2">
        <PopoverTitle className="font-display text-sm">{PURSE_HELP.title}</PopoverTitle>
        <PopoverDescription className="text-xs leading-relaxed">{PURSE_HELP.does}</PopoverDescription>
        {balance < 0 ? <p className="text-xs font-medium text-[var(--color-danger)]">{debtLine(balance)}</p> : null}
        <HelpRows help={PURSE_HELP} />
        <Link
          href="/profile#economy"
          onClick={() => setOpen(false)}
          className="mt-0.5 inline-flex h-10 items-center gap-1.5 self-start rounded-lg px-2 text-xs font-semibold text-[var(--color-gold)] outline-none hover:bg-[var(--color-gold)]/10 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Every source and sink
          <ArrowRightIcon className="size-3.5" aria-hidden />
        </Link>
      </PopoverContent>
    </Popover>
  )
}

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
    <span
      className={cn(
        "group relative inline-flex h-10 shrink-0 items-center rounded-full border text-sm font-semibold transition-colors",
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
      <Link
        href="/profile"
        aria-label={label}
        className="inline-flex h-full items-center gap-1.5 rounded-full pr-1 pl-2.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/45 sm:pl-3"
      >
        <CoinsIcon
          className={cn("size-4 shrink-0", inDebt ? "text-[var(--color-danger)]" : "text-[var(--color-gold)]")}
          aria-hidden
        />
        <AnimatedNumber value={balance} />
        {inDebt && <span className="hidden text-[10px] font-semibold tracking-[0.14em] uppercase sm:inline">debt</span>}
      </Link>
      <PurseInfo balance={balance} />
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
    </span>
  )
}
