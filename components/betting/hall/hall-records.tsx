"use client"

import {
  CrownIcon,
  DicesIcon,
  EyeIcon,
  FlameIcon,
  GemIcon,
  ShieldCheckIcon,
  SkullIcon,
  SwordsIcon,
  TrendingDownIcon,
  type LucideIcon,
} from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { InfoTip } from "@/components/ui/info-tip"
import { AnimatedNumber } from "@/components/betting/animated-number"
import { HALL_RECORD_HELP } from "@/lib/betting/help"
import { formatSigned, sideLabel } from "@/lib/betting/math"
import { HALL_RULES } from "@/lib/betting/rules"
import type { HallOfFame } from "@/lib/betting/types"
import type { HelpEntry } from "@/lib/help"
import { cn } from "@/lib/utils"

interface RecordCardProps {
  icon: LucideIcon
  help: HelpEntry
  flavor: string
  name: string | null
  avatarUrl: string | null
  value: number | null
  format?: (value: number) => string
  caption?: string
  tone?: "gold" | "win" | "loss" | "shield" | "fire"
  index: number
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`
}

const TONES = {
  gold: "text-[var(--color-gold)]",
  win: "text-emerald-300",
  loss: "text-rose-300",
  shield: "text-emerald-300",
  fire: "text-[var(--color-red-team)]",
} as const

function RecordCard({ icon: Icon, help, flavor, name, avatarUrl, value, format, caption, tone = "gold", index }: RecordCardProps) {
  const reduced = useReducedMotion()
  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduced ? 0 : index * 0.04, duration: 0.3 }}
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-[var(--color-gold)]/15 bg-card p-3 sm:p-4"
    >
      <div className="flex items-start gap-1.5">
        <Icon className={cn("size-4 shrink-0", TONES[tone])} aria-hidden />
        <h3 className="min-w-0 flex-1 text-[11px] font-semibold uppercase leading-tight tracking-[0.1em] text-[var(--color-gold)]/85 sm:tracking-[0.16em]">
          {help.title}
        </h3>
        <InfoTip help={help} align="end" className="-mt-0.5 -mr-1" />
      </div>
      {name && value != null ? (
        <>
          <div className="flex min-w-0 items-center gap-2">
            <Avatar size="sm" className="shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
              <AvatarFallback className="bg-[var(--color-navy-lighter)] text-[10px] font-semibold text-[var(--color-gold)]">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-semibold text-[var(--color-gold-light)]">{name}</span>
          </div>
          <AnimatedNumber
            from={0}
            value={value}
            format={format}
            className={cn("font-display text-2xl font-semibold tabular-nums leading-none", TONES[tone])}
          />
          {caption && <p className="text-[11px] text-muted-foreground">{caption}</p>}
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Vacant. The notebook awaits a name.</p>
      )}
      <p className="mt-auto text-[11px] italic leading-snug text-[var(--color-gold-light)]/55">{flavor}</p>
    </motion.article>
  )
}

export function HallRecords({ records }: { records: HallOfFame["records"] }) {
  const r = records
  const cards: Omit<RecordCardProps, "index">[] = [
    {
      icon: CrownIcon,
      help: HALL_RECORD_HELP.chosen,
      flavor: "Most profit from the book. Salaxe wants a cut.",
      name: r.chosen?.name ?? null,
      avatarUrl: r.chosen?.avatar_url ?? null,
      value: r.chosen?.net ?? null,
      format: formatSigned,
      caption: r.chosen ? `${r.chosen.won}-${r.chosen.lost} over ${plural(r.chosen.bets, "bet")}` : undefined,
      tone: "win",
    },
    {
      icon: TrendingDownIcon,
      help: HALL_RECORD_HELP.fool,
      flavor: "Fed the notebook more than anyone. Generous, in a way.",
      name: r.fool?.name ?? null,
      avatarUrl: r.fool?.avatar_url ?? null,
      value: r.fool?.net ?? null,
      format: formatSigned,
      caption: r.fool ? `${r.fool.won}-${r.fool.lost} over ${plural(r.fool.bets, "bet")}` : undefined,
      tone: "loss",
    },
    {
      icon: GemIcon,
      help: HALL_RECORD_HELP.heist,
      flavor: "Biggest single score. Clean in, clean out.",
      name: r.heist?.name ?? null,
      avatarUrl: r.heist?.avatar_url ?? null,
      value: r.heist?.net ?? null,
      format: formatSigned,
      caption: r.heist ? `${r.heist.amount} on ${sideLabel(r.heist.side)}` : undefined,
      tone: "win",
    },
    {
      icon: SkullIcon,
      help: HALL_RECORD_HELP.throw,
      flavor: "Worst single loss. Walked into the pit alone.",
      name: r.throw?.name ?? null,
      avatarUrl: r.throw?.avatar_url ?? null,
      value: r.throw?.net ?? null,
      format: formatSigned,
      caption: r.throw ? `${r.throw.amount} on ${sideLabel(r.throw.side)}` : undefined,
      tone: "loss",
    },
    {
      icon: SwordsIcon,
      help: HALL_RECORD_HELP.high_roller,
      flavor: "Largest stake ever written down. No hesitation.",
      name: r.high_roller?.name ?? null,
      avatarUrl: r.high_roller?.avatar_url ?? null,
      value: r.high_roller?.amount ?? null,
      caption: r.high_roller ? `${r.high_roller.status === "won" ? "Won" : "Lost"} on ${sideLabel(r.high_roller.side)}, net ${formatSigned(r.high_roller.net)}` : undefined,
    },
    {
      icon: DicesIcon,
      help: HALL_RECORD_HELP.degenerate,
      flavor: "Most wagers placed. Has not seen daylight since Act I.",
      name: r.degenerate?.name ?? null,
      avatarUrl: r.degenerate?.avatar_url ?? null,
      value: r.degenerate?.bets ?? null,
      caption: r.degenerate ? `${r.degenerate.volume} points wagered` : undefined,
    },
    {
      icon: EyeIcon,
      help: HALL_RECORD_HELP.oracle,
      flavor: `Best win rate, ${HALL_RULES.oracleMinDecided}+ decided bets. Probably scripting.`,
      name: r.oracle?.name ?? null,
      avatarUrl: r.oracle?.avatar_url ?? null,
      value: r.oracle?.win_rate ?? null,
      format: (v) => `${v}%`,
      caption: r.oracle ? `${r.oracle.won} of ${r.oracle.won + r.oracle.lost} called right` : undefined,
    },
    {
      icon: ShieldCheckIcon,
      help: HALL_RECORD_HELP.angel,
      flavor: "Most points pulled back by insurance. Coward, or genius.",
      name: r.angel?.name ?? null,
      avatarUrl: r.angel?.avatar_url ?? null,
      value: r.angel?.recovered ?? null,
      format: formatSigned,
      caption: r.angel ? plural(r.angel.insured, "insured bet") : undefined,
      tone: "shield",
    },
    {
      icon: FlameIcon,
      help: HALL_RECORD_HELP.boots,
      flavor: "Most all-ins. No brakes, no regrets, no purse.",
      name: r.boots?.name ?? null,
      avatarUrl: r.boots?.avatar_url ?? null,
      value: r.boots?.all_ins ?? null,
      caption: r.boots ? `Net ${formatSigned(r.boots.net)} overall` : undefined,
      tone: "fire",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3">
      {cards.map((card, index) => (
        <RecordCard key={card.help.title} {...card} index={index} />
      ))}
    </div>
  )
}
