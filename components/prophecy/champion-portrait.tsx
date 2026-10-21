import Image from "next/image"
import { getChampionImageUrl } from "@/lib/champions"
import { cn } from "@/lib/utils"
import type { Side } from "@/lib/types"

const SIZES = { sm: 28, md: 36, lg: 56, xl: 72 } as const

interface ChampionPortraitProps {
  championInternal: string
  champion: string
  side: Side
  size?: keyof typeof SIZES
  className?: string
}

export function ChampionPortrait({ championInternal, champion, side, size = "md", className }: ChampionPortraitProps) {
  const px = SIZES[size]
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 overflow-hidden rounded-full bg-[var(--color-navy)] ring-2",
        side === "blue" ? "ring-[var(--color-blue-team)]" : "ring-[var(--color-red-team)]",
        className
      )}
      style={{ width: px, height: px }}
    >
      <Image
        src={getChampionImageUrl(championInternal)}
        alt={champion}
        width={px}
        height={px}
        unoptimized
        className="size-full scale-110 object-cover"
      />
    </span>
  )
}
