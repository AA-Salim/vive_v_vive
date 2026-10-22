"use client"

import { motion, useReducedMotion } from "motion/react"
import { CrownIcon, DicesIcon, FlameIcon, HandHeartIcon, ShieldIcon, SwordsIcon, TrophyIcon, type LucideIcon } from "lucide-react"
import { PlayerAvatar } from "@/components/pages/avatars"
import { formatNumber } from "@/components/pages/format"
import { InfoTip } from "@/components/ui/info-tip"
import { awardHelp } from "@/lib/pages/help"
import type { ArchiveAward } from "@/lib/pages/types"

const CATEGORY: Record<string, { label: string; icon: LucideIcon; quip: string }> = {
  treasury: { label: "The Treasury", icon: CrownIcon, quip: "Richest noble when the curtain fell." },
  grand_champion: { label: "Grand Champion", icon: CrownIcon, quip: "Richest noble when the curtain fell." },
  warrior: { label: "The Warrior", icon: SwordsIcon, quip: "Best win rate of the act." },
  iron_man: { label: "The Iron Man", icon: ShieldIcon, quip: "Never left the Rift." },
  degenerate: { label: "The Degenerate", icon: DicesIcon, quip: "Bet on everything, always." },
  devotee: { label: "The Devotee", icon: HandHeartIcon, quip: "Kissed the most hands." },
  punching_bag: { label: "The Punching Bag", icon: FlameIcon, quip: "Shamed more than anyone." },
}

export function ArchiveHallOfFame({ awards }: { awards: ArchiveAward[] }) {
  const reduced = useReducedMotion()
  const champion = awards.find((a) => a.category === "treasury") ?? awards.find((a) => a.category === "grand_champion")
  const others = awards.filter((a) => a.category !== "treasury" && a.category !== "grand_champion")

  return (
    <div className="space-y-4">
      {champion ? (
        <motion.div
          initial={reduced ? false : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative mx-auto flex max-w-lg flex-col items-center gap-2 overflow-hidden rounded-2xl border border-[var(--color-gold)]/60 bg-linear-to-b from-[var(--color-gold)]/[0.14] to-card px-5 py-6 text-center shadow-[0_0_50px_-15px_var(--color-gold)]"
        >
          <CrownIcon className="size-8 text-[var(--color-gold)] drop-shadow-[0_0_12px_var(--color-gold)]" aria-hidden />
          <PlayerAvatar name={champion.name} src={champion.avatarUrl} size="xl" ring="gold" />
          <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.24em] text-muted-foreground uppercase">
            {champion.title}
            <InfoTip help={awardHelp(champion.category, CATEGORY[champion.category]?.label ?? champion.title, champion.bonus)} className="-my-1" />
          </p>
          <p className="font-display text-2xl font-semibold text-[var(--color-gold)]">{champion.name}</p>
          {champion.value ? <p className="font-display text-lg text-[var(--color-gold-light)]">{champion.value}</p> : null}
          {champion.bonus > 0 ? (
            <p className="text-xs text-muted-foreground">Carried {formatNumber(champion.bonus)} bonus points into the next act</p>
          ) : null}
        </motion.div>
      ) : null}

      {others.length > 0 ? (
        <ul className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3">
          {others.map((award, i) => {
            const meta = CATEGORY[award.category] ?? { label: award.category, icon: TrophyIcon, quip: "" }
            const Icon = meta.icon
            return (
              <motion.li
                key={award.id}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: reduced ? 0 : 0.15 + i * 0.05 }}
                className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--color-gold)]/20 bg-card p-3"
              >
                <div className="relative shrink-0">
                  <PlayerAvatar name={award.name} src={award.avatarUrl} size="md" />
                  <span className="absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full bg-[var(--color-gold)] text-[var(--color-navy)] ring-2 ring-card">
                    <Icon className="size-3" aria-hidden />
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center justify-between gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-[var(--color-gold)] uppercase">
                    <span className="truncate">{meta.label}</span>
                    <InfoTip help={awardHelp(award.category, meta.label, award.bonus)} className="-my-1 -mr-1" />
                  </p>
                  <p className="truncate text-sm font-semibold text-[var(--color-gold-light)]">{award.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {award.value ?? meta.quip}
                    {award.bonus > 0 ? ` · +${award.bonus} carried` : ""}
                  </p>
                </div>
              </motion.li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
