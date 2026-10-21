"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ShuffleIcon, SparklesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PRAISE_PROMPTS } from "@/lib/praise/prompts"

const ROTATE_MS = 7000

export function InspirationPrompt({ seed, paused }: { seed: number; paused: boolean }) {
  const [index, setIndex] = useState(() => seed % PRAISE_PROMPTS.length)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (paused || reduceMotion) return
    const interval = setInterval(() => setIndex((current) => (current + 1) % PRAISE_PROMPTS.length), ROTATE_MS)
    return () => clearInterval(interval)
  }, [paused, reduceMotion])

  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 py-1.5 pr-1.5 pl-3">
      <SparklesIcon className="size-4 shrink-0 text-[var(--color-gold)]" aria-hidden />
      <div className="min-w-0 flex-1 py-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]/80">
          Inspiration, not a template
        </p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={index}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-sm text-foreground/90"
          >
            {PRAISE_PROMPTS[index]}
          </motion.p>
        </AnimatePresence>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-10 shrink-0 text-[var(--color-gold)]"
        aria-label="Show another idea"
        onClick={() => setIndex((current) => (current + 1) % PRAISE_PROMPTS.length)}
      >
        <ShuffleIcon aria-hidden />
      </Button>
    </div>
  )
}
