"use client"

import { useEffect } from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"

import { cn } from "@/lib/utils"

const formatter = new Intl.NumberFormat("en-US")

interface AnimatedNumberProps {
  value: number
  signed?: boolean
  duration?: number
  format?: (value: number) => string
  className?: string
}

function defaultFormat(value: number, signed: boolean) {
  return `${signed && value > 0 ? "+" : ""}${formatter.format(value)}`
}

// Counts toward the new value instead of jumping; screen readers get the final number only.
function AnimatedNumber({ value, signed = false, duration = 0.8, format, className }: AnimatedNumberProps) {
  const reduce = useReducedMotion()
  const motionValue = useMotionValue(value)
  const text = useTransform(motionValue, (v) => {
    const n = Math.round(v)
    return format ? format(n) : defaultFormat(n, signed)
  })

  useEffect(() => {
    if (reduce) {
      motionValue.set(value)
      return
    }
    const controls = animate(motionValue, value, { duration, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [value, reduce, duration, motionValue])

  return (
    <span className={cn("relative inline-block tabular-nums", className)}>
      <motion.span aria-hidden>{text}</motion.span>
      <span className="sr-only">{format ? format(value) : defaultFormat(value, signed)}</span>
    </span>
  )
}

export { AnimatedNumber }
