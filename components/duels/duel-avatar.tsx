"use client"

import { CrownIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { Duelist } from "@/lib/duels/types"
import type { Side } from "@/lib/types"

const SIZES = {
  sm: "size-8 text-xs",
  md: "size-11 text-sm",
  lg: "size-14 text-base",
} as const

const RINGS: Record<Side, string> = {
  blue: "ring-[var(--color-blue-team)]/70",
  red: "ring-[var(--color-red-team)]/70",
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter(Boolean)
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : name.trim().slice(0, 2)
  return letters.toUpperCase() || "?"
}

interface DuelAvatarProps {
  duelist: Duelist | null
  side?: Side | null
  size?: keyof typeof SIZES
  winner?: boolean
  dim?: boolean
  className?: string
}

export function DuelAvatar({ duelist, side = null, size = "md", winner = false, dim = false, className }: DuelAvatarProps) {
  if (!duelist) {
    return (
      <span
        aria-hidden
        className={cn(
          "grid shrink-0 place-items-center rounded-full border border-dashed border-[var(--color-gold)]/45 bg-[var(--color-navy)]/70 font-display font-semibold text-[var(--color-gold)]/80",
          SIZES[size],
          className
        )}
      >
        ?
      </span>
    )
  }

  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Avatar
        className={cn(
          "ring-2 ring-offset-2 ring-offset-[var(--color-navy-light)] transition-[filter,opacity] duration-500",
          SIZES[size],
          winner ? "ring-[var(--color-gold)] shadow-[0_0_22px_-2px_var(--color-gold)]" : side ? RINGS[side] : "ring-border",
          dim && "opacity-55 grayscale"
        )}
      >
        {duelist.avatarUrl && <AvatarImage src={duelist.avatarUrl} alt="" />}
        <AvatarFallback className="bg-[var(--color-navy-lighter)] font-semibold text-[var(--color-gold-light)]">
          {initialsOf(duelist.name)}
        </AvatarFallback>
      </Avatar>
      {winner && (
        <span
          aria-hidden
          className="absolute -top-2.5 left-1/2 grid size-5 -translate-x-1/2 place-items-center rounded-full bg-[var(--color-gold)] text-[var(--color-navy)] shadow-sm"
        >
          <CrownIcon className="size-3" />
        </span>
      )}
    </span>
  )
}
