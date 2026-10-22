"use client"

import { motion, useReducedMotion } from "motion/react"
import { toast } from "sonner"
import { PlayerName } from "@/components/titles/player-name"
import { CATEGORY_ICON, iconKeyFor } from "@/components/titles/title-visuals"
import { perkInfo } from "@/lib/titles/catalog"
import type { EquippedTitle, TitleRarity } from "@/lib/titles/types"
import { cn } from "@/lib/utils"

export interface RaisedBanner {
  title: string
  category: string
  rarity?: TitleRarity
  wearer?: string | null
}

function asEntry(banner: RaisedBanner): EquippedTitle {
  const perk = perkInfo(banner.title, banner.category)
  return {
    userId: "self",
    playerId: null,
    title: banner.title,
    category: banner.category,
    perk: perk?.summary ?? null,
    kind: perk ? perk.kind : "cosmetic",
    rarity: banner.rarity,
  }
}

function EquipToast({ banner }: { banner: RaisedBanner }) {
  const reduced = useReducedMotion() ?? false
  const Icon = CATEGORY_ICON[iconKeyFor(banner.category, banner.rarity)]
  const perk = perkInfo(banner.title, banner.category)

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-[var(--color-gold)]/50 bg-linear-to-br from-[var(--color-gold-dark)]/45 via-popover to-popover p-3 text-popover-foreground shadow-lg shadow-black/40 min-[601px]:w-[var(--width)]">
      {!reduced && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-linear-to-r from-transparent via-[var(--color-gold-light)]/25 to-transparent"
          initial={{ x: "0%" }}
          animate={{ x: "420%" }}
          transition={{ duration: 1.2, ease: "easeOut", delay: 0.15 }}
        />
      )}
      <div className="flex items-start gap-3">
        <motion.span
          initial={reduced ? false : { scaleY: 0.2, rotate: -12, opacity: 0 }}
          animate={{ scaleY: 1, rotate: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 16 }}
          className="grid size-9 shrink-0 origin-top place-items-center rounded-lg border border-[var(--color-gold)]/50 bg-[var(--color-gold)]/15 text-[var(--color-gold)] shadow-[0_0_24px_-6px_var(--color-gold)]"
        >
          <Icon aria-hidden className="size-4" />
        </motion.span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-[var(--color-gold)] uppercase">Banner raised</p>
          <p className="mt-0.5 font-display text-sm leading-snug font-semibold">
            Hear ye: you are now{" "}
            <PlayerName name={banner.wearer || "you"} title={asEntry(banner)} epithet marks={false} inline />
          </p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
            {perk ? `${perk.summary}. Fires after your next game.` : "Pure prestige: the court sees your colors, the purse sees nothing."}
          </p>
        </div>
      </div>
    </div>
  )
}

export function showEquipToast(banner: RaisedBanner) {
  toast.custom(() => <EquipToast banner={banner} />, { id: "title-equipped", duration: 6_500 })
}

// Plays once when a banner is raised from the Hall: a gold sweep and a ring around the new colors.
export function BannerRaise({ className }: { className?: string }) {
  const reduced = useReducedMotion()
  if (reduced) return null
  return (
    <span aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]", className)}>
      <motion.span
        className="absolute inset-y-0 -left-1/2 w-1/2 bg-linear-to-r from-transparent via-[var(--color-gold-light)]/20 to-transparent"
        initial={{ x: "0%" }}
        animate={{ x: "400%" }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />
      <motion.span
        className="absolute inset-0 rounded-[inherit] ring-2 ring-[var(--color-gold)]"
        initial={{ opacity: 0.9, scale: 0.97 }}
        animate={{ opacity: 0, scale: 1.02 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      />
    </span>
  )
}
