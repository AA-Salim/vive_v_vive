"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { getDecree, type DecreeTier, type DecreeType } from "@/lib/chaos/catalog"
import { cn } from "@/lib/utils"
import { DecreeIcon } from "@/components/chaos/decree-icon"
import { TIER_STYLES } from "@/components/chaos/tier-styles"

export interface ProclamationItem {
  id: string
  actor: string
  type: DecreeType
  label: string
  headline: string
}

const SHOW_MS = 5500

export function useProclamation() {
  const [item, setItem] = useState<ProclamationItem | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const proclaim = useCallback((next: ProclamationItem) => {
    setItem((current) => (current?.id === next.id ? current : next))
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setItem(null), SHOW_MS)
  }, [])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  return { item, proclaim }
}

export function Proclamation({ item }: { item: ProclamationItem | null }) {
  const reduceMotion = useReducedMotion()
  const tier: DecreeTier = (item && getDecree(item.type)?.tier) || "wager"
  const style = TIER_STYLES[tier]

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {item ? `${item.actor} invokes ${item.label}. ${item.headline}` : ""}
      </p>
      <AnimatePresence mode="wait">
        {item && (
          <motion.div
            key={item.id}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className={cn(
              "relative overflow-hidden rounded-xl border bg-linear-to-r to-transparent p-3",
              "bg-[var(--color-navy)]/80",
              style.border,
              style.wash
            )}
          >
            <div className="flex items-start gap-3">
              <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border", style.border, style.text)}>
                <DecreeIcon type={item.type} className="size-[18px]" />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[var(--color-gold)]/80">
                  By royal decree
                </div>
                <div className="font-display text-[15px] font-semibold leading-snug text-[var(--color-gold-light)]">
                  {item.actor} invokes <span className={style.text}>{item.label}</span>
                </div>
                {item.headline && <p className="mt-0.5 text-xs text-[var(--color-gold-light)]/70">{item.headline}</p>}
              </div>
            </div>
            {!reduceMotion && (
              <motion.div
                aria-hidden
                className={cn("absolute bottom-0 left-0 h-0.5", style.dot)}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: SHOW_MS / 1000, ease: "linear" }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
