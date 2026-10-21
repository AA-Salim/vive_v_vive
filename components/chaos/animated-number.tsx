"use client"

import { useEffect } from "react"
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react"
import { cn } from "@/lib/utils"

interface AnimatedNumberProps {
  value: number
  className?: string
  signed?: boolean
}

export function AnimatedNumber({ value, className, signed = false }: AnimatedNumberProps) {
  const reduceMotion = useReducedMotion()
  const target = useMotionValue(value)
  const spring = useSpring(target, { stiffness: 160, damping: 24, mass: 0.6 })
  const text = useTransform(spring, (v) => {
    const rounded = Math.round(v)
    return signed && rounded > 0 ? `+${rounded}` : String(rounded)
  })

  useEffect(() => {
    if (reduceMotion) {
      target.jump(value)
      spring.jump(value)
    } else {
      target.set(value)
    }
  }, [value, reduceMotion, target, spring])

  return (
    <motion.span className={cn("tabular-nums", className)} aria-label={signed && value > 0 ? `+${value}` : String(value)}>
      {text}
    </motion.span>
  )
}
