"use client"

import { motion, useReducedMotion } from "motion/react"
import { GavelIcon, HourglassIcon, MegaphoneIcon } from "lucide-react"
import { InfoTip } from "@/components/ui/info-tip"
import { RelativeTime } from "@/components/live/relative-time"
import { useLive } from "@/components/live/live-context"
import { PlayerAvatar } from "@/components/bounties/player-avatar"
import { TimeLeft, useMsLeft } from "@/components/bounties/time-left"
import { EggButton } from "@/components/shame/egg-button"
import { PILLORY_COPY } from "@/lib/bounties/copy"
import { tribunalHelp } from "@/lib/bounties/help"
import { tribunalLine } from "@/lib/bounties/roasts"
import { laneWord } from "@/lib/bounties/shame-stats"
import type { PilloryEntryView } from "@/lib/bounties/types"
import { cn } from "@/lib/utils"

interface PilloryCardProps {
  entry: PilloryEntryView
  viewerPlayerId: string | null
  signedIn: boolean
  canEgg: boolean
  compact?: boolean
  onEgg: (entry: PilloryEntryView) => void
}

interface CardBodyProps {
  entry: PilloryEntryView
  isMe: boolean
  message: string
  canEgg: boolean
  eggDisabledLabel?: string
  onEgg: (entry: PilloryEntryView) => void
}

function TimeBar({ createdAt, expiresAt }: { createdAt: string; expiresAt: string }) {
  const left = useMsLeft(expiresAt)
  const total = Math.max(Date.parse(expiresAt) - Date.parse(createdAt), 1)
  const ratio = left === null ? 1 : Math.max(0, Math.min(1, left / total))
  return (
    <div aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-[var(--color-red-team)]/70 transition-[width] duration-700 ease-linear" style={{ width: `${ratio * 100}%` }} />
    </div>
  )
}

function Byline({ entry }: { entry: PilloryEntryView }) {
  const { clockOffset } = useLive()
  return (
    <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
      <MegaphoneIcon className="size-3 shrink-0" aria-hidden />
      <span className="truncate">by {entry.shamer?.name ?? "Someone"}</span>
      <span aria-hidden>·</span>
      <RelativeTime at={entry.createdAt} offset={clockOffset} phrase className="shrink-0" />
    </span>
  )
}

function CompactBody({ entry, isMe, message, canEgg, eggDisabledLabel, onEgg }: CardBodyProps) {
  const tribunal = entry.kind === "tribunal"
  return (
    <>
      <div className="flex items-start gap-2.5">
        <PlayerAvatar name={entry.target.name} avatarUrl={entry.target.avatarUrl} />
        <div className="min-w-0 flex-1">
          <p className="flex items-baseline gap-2">
            <span className="truncate font-display text-sm font-semibold text-[var(--color-gold-light)]">{entry.target.name}</span>
            {isMe && <span className="shrink-0 text-[11px] text-[var(--color-red-team)]">(you)</span>}
            <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
              <HourglassIcon className="size-3" aria-hidden />
              <TimeLeft until={entry.expiresAt} suffix="" />
            </span>
          </p>
          <p className="truncate text-xs">
            <span className="font-semibold uppercase tracking-[0.12em] text-[var(--color-red-team)]/90">{tribunal ? "Voted Inter" : entry.stat.label}</span>
            <span className="text-muted-foreground"> · </span>
            <span className="font-semibold text-[var(--color-gold-light)]">{entry.stat.value}</span>
          </p>
        </div>
      </div>
      {message && <blockquote className="mt-2 line-clamp-2 text-xs italic leading-snug text-[var(--color-gold-light)]/85">&ldquo;{message}&rdquo;</blockquote>}
      <div className="mt-1.5 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {tribunal ? (
            <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-[var(--color-gold)]">
              <GavelIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">Tribunal decree</span>
              <InfoTip help={tribunalHelp(entry)} align="start" />
            </span>
          ) : (
            <Byline entry={entry} />
          )}
        </div>
        <EggButton
          count={entry.eggs}
          thrown={entry.thrown}
          disabled={!canEgg || isMe}
          disabledLabel={eggDisabledLabel}
          compact
          targetName={entry.target.name}
          onThrow={() => onEgg(entry)}
        />
      </div>
    </>
  )
}

function FullBody({ entry, isMe, message, canEgg, eggDisabledLabel, onEgg }: CardBodyProps) {
  const tribunal = entry.kind === "tribunal"
  const verdict = entry.tribunal
  return (
    <>
      <header className="flex items-center gap-2.5">
        <PlayerAvatar name={entry.target.name} avatarUrl={entry.target.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg font-semibold text-[var(--color-gold-light)]">
            {entry.target.name}
            {isMe && <span className="ml-1.5 text-[11px] font-normal text-[var(--color-red-team)]">(you)</span>}
          </h3>
          {tribunal ? (
            <p className="flex min-w-0 items-center gap-1 text-xs font-semibold text-[var(--color-gold)]">
              <GavelIcon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{PILLORY_COPY.tribunal}</span>
              <InfoTip help={tribunalHelp(entry)} side="bottom" align="start" />
            </p>
          ) : (
            <Byline entry={entry} />
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] tabular-nums text-muted-foreground">
          <HourglassIcon className="size-3.5" aria-hidden />
          <TimeLeft until={entry.expiresAt} />
        </span>
      </header>

      <div className="mt-3 rounded-xl border border-[var(--color-red-team)]/20 bg-[var(--color-red-team)]/10 px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-red-team)]/90">{entry.stat.label}</p>
        <p className="font-display text-xl font-bold leading-tight text-[var(--color-gold-light)]">{entry.stat.value}</p>
      </div>

      {message && <blockquote className="mt-3 text-sm italic leading-snug text-[var(--color-gold-light)]/85">&ldquo;{message}&rdquo;</blockquote>}

      {verdict?.champion && (
        <p className="mt-2 text-xs text-muted-foreground">
          Played {verdict.champion}
          {verdict.lane ? ` ${laneWord(verdict.lane)}` : ""}. {verdict.votes} of {verdict.ballots} ballots said Inter.
        </p>
      )}

      {entry.recentLosses.length > 0 && (
        <p className="mt-2 truncate text-xs text-muted-foreground">
          Recent losses: {entry.recentLosses.map((l) => `${l.champion}${l.lane ? ` ${laneWord(l.lane)}` : ""}`).join(", ")}
        </p>
      )}

      {isMe && <p className="mt-2 text-xs text-[var(--color-red-team)]">{PILLORY_COPY.you}</p>}

      <div className="mt-3 flex items-center gap-3">
        <div className="flex-1">
          <TimeBar createdAt={entry.createdAt} expiresAt={entry.expiresAt} />
        </div>
        <EggButton
          count={entry.eggs}
          thrown={entry.thrown}
          disabled={!canEgg || isMe}
          disabledLabel={eggDisabledLabel}
          targetName={entry.target.name}
          onThrow={() => onEgg(entry)}
        />
      </div>
    </>
  )
}

export function PilloryCard({ entry, viewerPlayerId, signedIn, canEgg, compact = false, onEgg }: PilloryCardProps) {
  const reduce = useReducedMotion()
  const tribunal = entry.kind === "tribunal"
  const isMe = !!viewerPlayerId && viewerPlayerId === entry.target.playerId
  const optimistic = entry.id.startsWith("optimistic-")
  const body: CardBodyProps = {
    entry,
    isMe,
    message: entry.message || (entry.tribunal ? tribunalLine(entry.tribunal, entry.id) : ""),
    canEgg: canEgg && !optimistic,
    eggDisabledLabel: !signedIn ? "Sign in to throw eggs" : isMe ? "You cannot egg yourself" : undefined,
    onEgg,
  }

  return (
    <motion.article
      layout={reduce ? false : "position"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, rotate: -0.6 }}
      animate={{ opacity: optimistic ? 0.7 : 1, y: 0, rotate: 0 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      aria-label={`${entry.target.name} on the pillory: ${entry.stat.label}, ${entry.stat.value}`}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-[var(--color-navy)]/70",
        compact ? "p-3" : "p-4",
        tribunal ? "border-[var(--color-gold)]/40" : "border-[var(--color-red-team)]/20",
        isMe && "ring-1 ring-[var(--color-red-team)]/40"
      )}
    >
      {tribunal && (
        <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)]/80 to-transparent" />
      )}
      {compact ? <CompactBody {...body} /> : <FullBody {...body} />}
    </motion.article>
  )
}
