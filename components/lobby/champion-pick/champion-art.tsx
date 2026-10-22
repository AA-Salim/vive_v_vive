"use client"

import { useState } from "react"
import Image from "next/image"
import { getChampionImageUrl } from "@/lib/champions"
import { cn } from "@/lib/utils"

interface ChampionArtProps {
  internal: string
  name: string
  // Pixel size; omit to fill the parent (size it with className).
  size?: number
  className?: string
  decorative?: boolean
}

// Square ddragon portrait, trimmed of its baked-in border. Falls back to the initial when the CDN misses.
export function ChampionArt({ internal, name, size, className, decorative = false }: ChampionArtProps) {
  const [failed, setFailed] = useState<string | null>(null)
  const pixels = size ?? 64
  return (
    <span
      className={cn("relative block shrink-0 overflow-hidden bg-muted", !size && "size-full", className)}
      style={size ? { width: size, height: size } : undefined}
    >
      {failed === internal ? (
        <span
          aria-hidden={decorative || undefined}
          className="flex size-full items-center justify-center font-display font-semibold text-[var(--color-gold)]/70"
          style={{ fontSize: Math.round(pixels * 0.42) }}
        >
          {name.charAt(0)}
        </span>
      ) : (
        <Image
          src={getChampionImageUrl(internal)}
          alt={decorative ? "" : name}
          width={pixels}
          height={pixels}
          unoptimized
          draggable={false}
          onError={() => setFailed(internal)}
          className="size-full scale-110 object-cover"
        />
      )}
    </span>
  )
}
