import { CrownIcon, SkullIcon, type LucideIcon } from "lucide-react"
import type { Category } from "@/lib/prophecy/constants"

export interface CategoryTone {
  icon: LucideIcon
  text: string
  softText: string
  border: string
  selected: string
  chip: string
  fill: string
  glow: string
  ring: string
}

// MVP wears the crown gold; the Inter gets Baron purple (the color of every solo Baron call).
export const TONES: Record<Category, CategoryTone> = {
  mvp: {
    icon: CrownIcon,
    text: "text-[var(--color-gold)]",
    softText: "text-[var(--color-gold-light)]/80",
    border: "border-[var(--color-gold)]/35",
    selected: "border-[var(--color-gold)] bg-[var(--color-gold)]/12 ring-1 ring-[var(--color-gold)]",
    chip: "bg-[var(--color-gold)]/15 text-[var(--color-gold)]",
    fill: "bg-[var(--color-gold)]",
    glow: "from-[var(--color-gold)]/25",
    ring: "ring-[var(--color-gold)]",
  },
  inter: {
    icon: SkullIcon,
    text: "text-violet-300",
    softText: "text-violet-200/80",
    border: "border-violet-400/35",
    selected: "border-violet-400 bg-violet-500/12 ring-1 ring-violet-400",
    chip: "bg-violet-500/15 text-violet-300",
    fill: "bg-violet-400",
    glow: "from-violet-500/25",
    ring: "ring-violet-400",
  },
}
