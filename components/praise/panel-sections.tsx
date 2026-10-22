"use client"

import { AnimatePresence, motion } from "motion/react"
import {
  FeatherIcon,
  GavelIcon,
  HourglassIcon,
  LibraryIcon,
  LogInIcon,
  RefreshCwIcon,
  ScrollTextIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { AnimatedNumber } from "@/components/praise/animated-number"
import { COMPOSE_HELP, VERDICT_HELP } from "@/components/praise/help"
import { AuthorAvatar, PraiseQuote } from "@/components/praise/praise-card"
import { PraiseCountdown } from "@/components/praise/praise-countdown"
import { BoostedAmount, TitleBonusChips, usePraiseTerms } from "@/components/praise/title-bonus"
import { VerdictChip } from "@/components/praise/verdict-chip"
import { formatRelative } from "@/lib/praise/format"
import { kissReward, RIDDLE_FIRST_TRY_BONUS, ROYAL_FAVOR, type PraiseRules } from "@/lib/praise/rules"
import type { PraiseCourt, PraiseMe, PraiseView } from "@/lib/praise/types"
import { COOLDOWN_LINES, COPY, SELF_PRAISE_LINE, seededPick, verdictLine } from "@/lib/praise/voice"

const LABEL = "text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"

export function PanelSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading Sing His Praises">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}

export function ErrorSection({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="space-y-3">
      <p className="text-sm text-foreground/90">{COPY.errorTitle}</p>
      <Button variant="outline" className="h-10 w-full" onClick={onRetry}>
        <RefreshCwIcon aria-hidden />
        {COPY.retry}
      </Button>
    </div>
  )
}

export function MigrationPendingSection() {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg border border-dashed border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 p-3">
        <ScrollTextIcon className="mt-0.5 size-5 shrink-0 text-[var(--color-gold)]/70" aria-hidden />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{COPY.pendingTitle}</p>
          <p className="text-xs text-muted-foreground">{COPY.pendingBody}</p>
        </div>
      </div>
      <Button disabled className="h-11 w-full">
        <FeatherIcon aria-hidden />
        {COPY.compose}
      </Button>
    </div>
  )
}

export function LoggedOutSection({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="font-display text-sm text-foreground">{COPY.loggedOutTitle}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{COPY.loggedOutBody}</p>
      </div>
      <Button className="h-10 w-full" onClick={onLogin}>
        <LogInIcon aria-hidden />
        {COPY.login}
      </Button>
    </div>
  )
}

interface ReadySectionProps {
  me: PraiseMe
  rules: PraiseRules
  salaxeUserId: string | null
  onCompose: () => void
}

export function ReadySection({ me, rules, salaxeUserId, onCompose }: ReadySectionProps) {
  const slot = me.nextSlot ?? me.sungToday + 1
  const terms = usePraiseTerms(me.nextReward ?? kissReward(rules, slot))
  const several = rules.perDay > 1
  const line = rules.version < 2 ? `${rules.minWords}+ words` : `one line of ${rules.maxChars} characters at most`
  return (
    <div className="space-y-2.5">
      {me.today ? <TodaySong song={me.today} salaxeUserId={salaxeUserId} label={COPY.latestLabel} /> : null}
      <div className="flex items-center gap-2.5">
        <Button
          className="h-11 min-w-0 flex-1 justify-between gap-2 text-[15px] font-semibold shadow-lg shadow-primary/20"
          onClick={onCompose}
        >
          <span className="flex min-w-0 items-center gap-2">
            <FeatherIcon aria-hidden />
            <span className="truncate">{me.sungToday > 0 ? COPY.kissAgainShort : COPY.compose}</span>
          </span>
          <BoostedAmount value={terms.reward} base={terms.base} className="rounded-md bg-primary-foreground/15 px-1.5 py-0.5 text-sm tabular-nums" />
        </Button>
        <InfoTip help={COMPOSE_HELP} side="top" align="end" />
      </div>
      {several ? (
        <p className="text-[11px] font-semibold text-[var(--color-gold-light)]/85 tabular-nums">
          {COPY.kissOf(slot, rules.perDay, terms.reward)} · {COPY.leftToday(me.remainingToday)}
        </p>
      ) : null}
      <TitleBonusChips notes={[...terms.rewardNotes, ...terms.favorNotes]} />
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {several
          ? `Up to ${rules.perDay} praises a day, worth ${rules.rewards.join(", ")} in that order. Each one needs its own King's Riddle (+${RIDDLE_FIRST_TRY_BONUS} on the first try), then sing him ${line} that name him, never an insult.`
          : `One praise a day: solve the King's Riddle (+${RIDDLE_FIRST_TRY_BONUS} on the first try), then sing him ${line} that name him, never an insult.`}{" "}
        The best ones get crowned for +{terms.favor}
        {terms.favor !== ROYAL_FAVOR ? ` (instead of +${ROYAL_FAVOR})` : ""}.
      </p>
      {me.total > 0 && (
        <p className="text-[11px] text-muted-foreground">
          <AnimatedNumber value={me.total} className="font-semibold text-foreground" />{" "}
          {me.total === 1 ? "song" : "songs"} sung,{" "}
          <AnimatedNumber value={me.crowned} className="font-semibold text-[var(--color-gold)]" /> crowned
        </p>
      )}
    </div>
  )
}

// The caller's latest song of the day with Salaxe's remark (or verdict).
function TodaySong({ song, salaxeUserId, label }: { song: PraiseView; salaxeUserId: string | null; label: string }) {
  const selfPraise = song.author.userId === salaxeUserId
  const remark = song.verdict
    ? song.verdictNote || verdictLine(song.verdict, song.id)
    : selfPraise
      ? SELF_PRAISE_LINE
      : verdictLine(null, song.id)
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={LABEL}>{label}</span>
        <VerdictChip verdict={song.verdict} favor={song.favor} selfPraise={selfPraise} />
      </div>
      <PraiseQuote body={song.body} className="line-clamp-4 text-sm" />
      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-[var(--color-gold)]">Salaxe: </span>
        {remark}
      </p>
    </div>
  )
}

interface CooldownSectionProps {
  me: PraiseMe
  perDay: number
  today: string
  resetsAt: string
  clockOffset: number
  salaxeUserId: string | null
  onElapsed: () => void
}

export function CooldownSection({ me, perDay, today, resetsAt, clockOffset, salaxeUserId, onElapsed }: CooldownSectionProps) {
  const song = me.today

  return (
    <div className="space-y-2.5">
      {song && (
        <TodaySong song={song} salaxeUserId={salaxeUserId} label={perDay > 1 ? COPY.latestLabel : COPY.todayLabel} />
      )}
      <div className="flex items-center gap-2 rounded-lg bg-[var(--color-gold)]/5 px-3 py-2 text-xs text-muted-foreground">
        <HourglassIcon className="size-4 shrink-0 text-[var(--color-gold)]" aria-hidden />
        <span>
          {perDay > 1 ? `${COPY.allKissed(perDay)} ${COPY.comeBack} ` : null}
          {COPY.nextSong}{" "}
          <PraiseCountdown
            target={resetsAt}
            clockOffset={clockOffset}
            onElapsed={onElapsed}
            className="font-semibold tabular-nums text-foreground"
          />
        </span>
      </div>
      {!song && <p className="text-[11px] text-muted-foreground">{seededPick(COOLDOWN_LINES, today)}</p>}
    </div>
  )
}

export function CourtSection({ court, onHoldCourt }: { court: PraiseCourt; onHoldCourt: () => void }) {
  return (
    <div className="rounded-lg border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 p-3">
      <div className="flex items-center gap-1.5">
        <p className="flex items-center gap-2 font-display text-sm text-[var(--color-gold)]">
          <GavelIcon className="size-4" aria-hidden />
          {COPY.courtTitle}
        </p>
        <InfoTip help={VERDICT_HELP} side="bottom" align="start" />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        <AnimatedNumber value={court.pending} className="font-semibold text-foreground" />{" "}
        {court.pending === 1 ? "song awaits" : "songs await"} your verdict.{" "}
        <span className="whitespace-nowrap">
          {court.crownsLeft}/{court.crownLimit} crowns left today.
        </span>
      </p>
      <Button variant="outline" className="mt-2.5 h-10 w-full border-[var(--color-gold)]/40" onClick={onHoldCourt}>
        <GavelIcon aria-hidden />
        {COPY.holdCourt}
      </Button>
    </div>
  )
}

interface FeaturedSectionProps {
  featured: PraiseView | null
  totalCount: number
  now: number
  onOpenHall: () => void
}

export function FeaturedSection({ featured, totalCount, now, onOpenHall }: FeaturedSectionProps) {
  return (
    <div className="space-y-2.5 border-t border-border pt-3">
      {featured ? (
        <>
          <p className={LABEL}>{featured.verdict === "crowned" ? COPY.featuredCrowned : COPY.featuredLatest}</p>
          <AnimatePresence mode="wait" initial={false}>
            <motion.figure
              key={featured.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <PraiseQuote body={featured.body} className="line-clamp-4 text-sm" />
              <figcaption className="mt-2 flex min-w-0 items-center gap-2 text-xs">
                <AuthorAvatar author={featured.author} size="sm" />
                <span className="min-w-0 truncate font-medium text-foreground">{featured.author.name}</span>
                <time dateTime={featured.createdAt} className="shrink-0 text-muted-foreground">
                  {formatRelative(featured.createdAt, now)}
                </time>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </>
      ) : totalCount === 0 ? (
        <p className="text-xs text-muted-foreground">{COPY.emptyLatest}</p>
      ) : null}
      <Button variant="outline" className="h-10 w-full justify-between" onClick={onOpenHall}>
        <span className="flex items-center gap-2">
          <LibraryIcon aria-hidden />
          {COPY.hallButton}
        </span>
        <AnimatedNumber value={totalCount} className="text-muted-foreground" />
      </Button>
    </div>
  )
}
