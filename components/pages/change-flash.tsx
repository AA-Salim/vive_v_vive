"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { useAnimate, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

interface ChangeFlashProps {
  value: number
  children: ReactNode
  className?: string
}

// Washes its box green or red for a moment whenever value moves, e.g. a balance changing live.
export function ChangeFlash({ value, children, className }: ChangeFlashProps) {
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const reduced = useReducedMotion()
  const previous = useRef(value)

  useEffect(() => {
    const before = previous.current
    previous.current = value
    if (before === value || reduced || !scope.current) return
    const selector = value > before ? "[data-flash='up']" : "[data-flash='down']"
    const controls = animate(selector, { opacity: [1, 0] }, { duration: 1.8, ease: "easeOut" })
    return () => controls.stop()
  }, [value, reduced, animate, scope])

  return (
    <div ref={scope} className={cn("relative", className)}>
      <span aria-hidden data-flash="up" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-emerald-400/15 opacity-0" />
      <span aria-hidden data-flash="down" className="pointer-events-none absolute inset-0 rounded-[inherit] bg-rose-400/15 opacity-0" />
      {children}
    </div>
  )
}
