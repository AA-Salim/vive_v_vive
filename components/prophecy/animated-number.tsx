"use client"

import { useEffect } from "react"
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react"
import { cn } from "@/lib/utils"

interface AnimatedNumberProps {
  value: number
  className?: string
  prefix?: string
  suffix?: string
}

export function AnimatedNumber({ value, className, prefix = "", suffix = "" }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion()
  const motionValue = useMotionValue(value)
  const text = useTransform(motionValue, (v) => `${prefix}${Math.round(v)}${suffix}`)

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value)
      return
    }
    const controls = animate(motionValue, value, { duration: 0.7, ease: [0.22, 1, 0.36, 1] })
    return () => controls.stop()
  }, [value, reduceMotion, motionValue])

  return <motion.span className={cn("tabular-nums", className)}>{text}</motion.span>
}
