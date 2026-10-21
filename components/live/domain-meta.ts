import {
  AwardIcon,
  BanIcon,
  BookOpenIcon,
  CoinsIcon,
  CrosshairIcon,
  CrownIcon,
  EyeIcon,
  FlagIcon,
  GavelIcon,
  type LucideIcon,
  MegaphoneIcon,
  ScrollTextIcon,
  SwordsIcon,
  TrendingUpIcon,
  TrophyIcon,
  UsersIcon,
  VoteIcon,
  ZapIcon,
} from "lucide-react"
import { domainOf, type LiveDomain, type LiveEventType } from "@/lib/live/events"
import type { LiveTone } from "@/lib/live/tone"

export interface DomainMeta {
  icon: LucideIcon
  label: string
}

const META: Partial<Record<LiveDomain, DomainMeta>> = {
  session: { icon: FlagIcon, label: "The Rift" },
  coachdraft: { icon: GavelIcon, label: "Coach draft" },
  bet: { icon: CoinsIcon, label: "Betting" },
  chaos: { icon: ScrollTextIcon, label: "Royal decree" },
  praise: { icon: CrownIcon, label: "The court" },
  sidebet: { icon: EyeIcon, label: "Prophecy" },
  bounty: { icon: CrosshairIcon, label: "Bounty" },
  shame: { icon: MegaphoneIcon, label: "Shame board" },
  title: { icon: AwardIcon, label: "Titles" },
  queue: { icon: UsersIcon, label: "Queue" },
  vainqueur: { icon: TrophyIcon, label: "Winner stays" },
  fearless: { icon: BanIcon, label: "Fearless" },
  points: { icon: TrendingUpIcon, label: "Treasury" },
  act: { icon: BookOpenIcon, label: "New act" },
  duel: { icon: SwordsIcon, label: "Duel" },
  vote: { icon: VoteIcon, label: "Tribunal" },
}

const FALLBACK: DomainMeta = { icon: ZapIcon, label: "Live" }

export function metaFor(type: LiveEventType): DomainMeta {
  return META[domainOf(type)] ?? FALLBACK
}

// Tone accents shared by toasts and the activity feed (CSS variables only, no raw colors).
export const TONE_CHIP: Record<LiveTone, string> = {
  info: "bg-muted text-[var(--color-gold-light)]/80 ring-border",
  hype: "bg-[var(--color-gold)]/15 text-[var(--color-gold)] ring-[var(--color-gold)]/40",
  royal: "bg-[var(--color-gold-dark)]/30 text-[var(--color-gold-light)] ring-[var(--color-gold)]/30",
  roast: "bg-[var(--color-red-team)]/10 text-[var(--color-red-team)] ring-[var(--color-red-team)]/30",
  danger: "bg-[var(--color-red-team)]/20 text-[var(--color-red-team)] ring-[var(--color-red-team)]/50",
}
