import {
  Coins,
  Crown,
  Dices,
  Footprints,
  HandCoins,
  HeartCrack,
  Medal,
  Skull,
  Sparkles,
  Sword,
  Swords,
  Target,
  Trophy,
  Undo2,
  Zap,
  type LucideIcon,
} from "lucide-react"
import type { PerkTrigger, TitleRarity } from "@/lib/titles/types"

export const RARITY_BADGE: Record<TitleRarity, string> = {
  common: "border-[var(--color-gold-light)]/15 bg-[var(--color-gold-light)]/[0.04] text-[var(--color-gold-light)]/85",
  rare: "border-sky-400/35 bg-sky-400/10 text-sky-200",
  epic: "border-violet-400/40 bg-violet-500/10 text-violet-200",
  legendary:
    "border-[var(--color-gold)]/60 bg-[var(--color-gold)]/15 text-[var(--color-gold-light)] shadow-[0_0_14px_-6px_var(--color-gold)]",
  cursed: "border-dashed border-rose-500/50 bg-rose-500/10 text-rose-200",
}

export const RARITY_TEXT: Record<TitleRarity, string> = {
  common: "text-[var(--color-gold-light)]/60",
  rare: "text-sky-300",
  epic: "text-violet-300",
  legendary: "text-[var(--color-gold)]",
  cursed: "text-rose-300",
}

export const RARITY_FRAME: Record<TitleRarity, string> = {
  common: "border-border",
  rare: "border-sky-400/20",
  epic: "border-violet-400/25",
  legendary: "border-[var(--color-gold)]/40",
  cursed: "border-rose-500/30",
}

export const CATEGORY_ICON = {
  rebellion: Swords,
  loyalty: Crown,
  absurd: Sparkles,
  mockery: Skull,
  award: Medal,
  legendary: Trophy,
} satisfies Record<string, LucideIcon>

export type TitleIconKey = keyof typeof CATEGORY_ICON

export function iconKeyFor(category: string | undefined, rarity?: TitleRarity): TitleIconKey {
  if (category === "award" && rarity === "legendary") return "legendary"
  return category && category in CATEGORY_ICON ? (category as TitleIconKey) : "absurd"
}

export const TRIGGER_ICON: Record<PerkTrigger, LucideIcon> = {
  win: Trophy,
  loss: HeartCrack,
  play: Footprints,
  bet_win: Coins,
  bet_loss: Undo2,
  bet_any: Coins,
  crown_falls: Sword,
  crown_wins: Crown,
  chance: Dices,
  pool: HandCoins,
  chaos: Zap,
  bounty: Target,
}
