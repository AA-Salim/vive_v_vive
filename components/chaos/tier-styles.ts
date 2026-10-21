import type { DecreeTier } from "@/lib/chaos/catalog"

export interface TierStyle {
  text: string
  border: string
  wash: string
  chip: string
  ring: string
  focus: string
  solid: string
  dot: string
}

export const TIER_STYLES: Record<DecreeTier, TierStyle> = {
  wager: {
    text: "text-[var(--color-gold)]",
    border: "border-[var(--color-gold)]/35",
    wash: "from-[var(--color-gold)]/14",
    chip: "bg-[var(--color-gold)]/15 text-[var(--color-gold)]",
    ring: "ring-[var(--color-gold)]/70",
    focus: "focus-visible:ring-[var(--color-gold)]/70",
    solid: "bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]",
    dot: "bg-[var(--color-gold)]",
  },
  favor: {
    text: "text-emerald-300",
    border: "border-emerald-400/30",
    wash: "from-emerald-400/12",
    chip: "bg-emerald-400/15 text-emerald-300",
    ring: "ring-emerald-300/70",
    focus: "focus-visible:ring-emerald-300/70",
    solid: "bg-emerald-400 text-[var(--color-navy)] hover:bg-emerald-300",
    dot: "bg-emerald-400",
  },
  sabotage: {
    text: "text-violet-300",
    border: "border-violet-400/30",
    wash: "from-violet-400/14",
    chip: "bg-violet-400/15 text-violet-300",
    ring: "ring-violet-300/70",
    focus: "focus-visible:ring-violet-300/70",
    solid: "bg-violet-400 text-[var(--color-navy)] hover:bg-violet-300",
    dot: "bg-violet-400",
  },
  cataclysm: {
    text: "text-orange-300",
    border: "border-orange-400/35",
    wash: "from-orange-500/16",
    chip: "bg-orange-400/15 text-orange-300",
    ring: "ring-orange-300/70",
    focus: "focus-visible:ring-orange-300/70",
    solid: "bg-orange-400 text-[var(--color-navy)] hover:bg-orange-300",
    dot: "bg-orange-400",
  },
}

export const SIDE_STYLES = {
  blue: {
    text: "text-[var(--color-blue-team)]",
    border: "border-[var(--color-blue-team)]/40",
    wash: "bg-[var(--color-blue-team)]/10",
    ring: "ring-[var(--color-blue-team)]",
  },
  red: {
    text: "text-[var(--color-red-team)]",
    border: "border-[var(--color-red-team)]/40",
    wash: "bg-[var(--color-red-team)]/10",
    ring: "ring-[var(--color-red-team)]",
  },
} as const
