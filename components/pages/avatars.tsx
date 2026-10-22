"use client"

import type { CSSProperties } from "react"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getChampionImageUrl } from "@/lib/champions"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

const AVATAR_SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
} as const

const RINGS = {
  gold: "ring-2 ring-[var(--color-gold)] ring-offset-2 ring-offset-[var(--color-navy-light)]",
  silver: "ring-2 ring-[var(--color-gold-light)]/60 ring-offset-2 ring-offset-[var(--color-navy-light)]",
  bronze: "ring-2 ring-[var(--color-gold-dark)] ring-offset-2 ring-offset-[var(--color-navy-light)]",
  blue: "ring-2 ring-[var(--color-blue-team)]",
  red: "ring-2 ring-[var(--color-red-team)]",
} as const

interface PlayerAvatarProps {
  name: string
  src?: string | null
  size?: keyof typeof AVATAR_SIZES
  ring?: keyof typeof RINGS | null
  className?: string
}

export function PlayerAvatar({ name, src, size = "sm", ring = null, className }: PlayerAvatarProps) {
  return (
    <Avatar className={cn("shrink-0", AVATAR_SIZES[size], ring && RINGS[ring], className)}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className="bg-[var(--color-navy-lighter)] font-display font-semibold text-[var(--color-gold)]">
        {name.trim().charAt(0).toUpperCase() || "?"}
      </AvatarFallback>
    </Avatar>
  )
}

const SIDE_RING: Record<Side, string> = {
  blue: "ring-[var(--color-blue-team)]/80",
  red: "ring-[var(--color-red-team)]/80",
}

interface ChampionIconProps {
  name: string
  internal: string | null
  size?: number
  side?: Side | null
  dimmed?: boolean
  rounded?: "md" | "full"
  className?: string
}

export function ChampionIcon({ name, internal, size = 32, side = null, dimmed = false, rounded = "md", className }: ChampionIconProps) {
  return (
    <span
      className={cn(
        "relative inline-block size-(--icon-size) shrink-0 overflow-hidden bg-[var(--color-navy-lighter)]",
        rounded === "full" ? "rounded-full" : "rounded-md",
        side ? cn("ring-2", SIDE_RING[side]) : "ring-1 ring-[var(--color-gold)]/20",
        dimmed && "opacity-55 grayscale-[35%]",
        className
      )}
      style={{ "--icon-size": `${size}px` } as CSSProperties}
      title={name}
    >
      {internal ? (
        <Image
          src={getChampionImageUrl(internal)}
          alt={name}
          width={size}
          height={size}
          unoptimized
          draggable={false}
          className="size-full scale-110 object-cover"
        />
      ) : (
        <span
          aria-label={name}
          className="grid size-full place-items-center font-display font-semibold text-[var(--color-gold)]/70"
          style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }}
        >
          {name.slice(0, 2)}
        </span>
      )}
    </span>
  )
}
