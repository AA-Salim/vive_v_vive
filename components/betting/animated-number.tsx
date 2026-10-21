"use client"

import { useEffect } from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"

interface AnimatedNumberProps {
  value: number
  from?: number
  decimals?: number
  duration?: number
  format?: (value: number) => string
  className?: string
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function AnimatedNumber({ value, from, decimals = 0, duration = 0.7, format, className }: AnimatedNumberProps) {
  const reduced = useReducedMotion()
  const motionValue = useMotionValue(from ?? value)
  const text = useTransform(motionValue, (v) => {
    const rounded = roundTo(v, decimals)
    return format ? format(rounded) : rounded.toFixed(decimals)
  })

  useEffect(() => {
    if (reduced) {
      motionValue.set(value)
      return
    }
    const controls = animate(motionValue, value, { duration, ease: [0.16, 1, 0.3, 1] })
    return () => controls.stop()
  }, [value, reduced, duration, motionValue])

  return <motion.span className={className}>{text}</motion.span>
}
