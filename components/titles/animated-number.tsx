"use client"

import { useEffect } from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import { cn } from "@/lib/utils"

interface AnimatedNumberProps {
  value: number
  signed?: boolean
  className?: string
}

export function AnimatedNumber({ value, signed = false, className }: AnimatedNumberProps) {
  const reduce = useReducedMotion()
  const motionValue = useMotionValue(value)
  const text = useTransform(motionValue, (v) => {
    const n = Math.round(v)
    return `${signed && n > 0 ? "+" : ""}${n.toLocaleString("en-US")}`
  })

  useEffect(() => {
    if (reduce) {
      motionValue.set(value)
      return
    }
    const controls = animate(motionValue, value, { duration: 0.7, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [value, reduce, motionValue])

  return (
    <motion.span className={cn("tabular-nums", className)} aria-label={`${signed && value > 0 ? "+" : ""}${value}`}>
      {text}
    </motion.span>
  )
}
