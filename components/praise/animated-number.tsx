"use client"

import { useEffect } from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import { formatPoints } from "@/lib/praise/format"
import { cn } from "@/lib/utils"

interface AnimatedNumberProps {
  value: number
  from?: number
  prefix?: string
  duration?: number
  className?: string
}

export function AnimatedNumber({ value, from, prefix = "", duration = 0.8, className }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion()
  const motionValue = useMotionValue(from ?? value)
  const text = useTransform(motionValue, (latest) => `${prefix}${formatPoints(Math.round(latest))}`)

  useEffect(() => {
    if (reduceMotion) {
      motionValue.jump(value)
      return
    }
    const controls = animate(motionValue, value, { duration, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [motionValue, value, duration, reduceMotion])

  return (
    <span className={cn("tabular-nums", className)}>
      <motion.span aria-hidden>{text}</motion.span>
      <span className="sr-only">{`${prefix}${formatPoints(value)}`}</span>
    </span>
  )
}
