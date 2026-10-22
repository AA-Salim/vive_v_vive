"use client"

import { motion, useReducedMotion } from "motion/react"
import { CrosshairIcon, CrownIcon, HourglassIcon, PlusIcon, ScrollTextIcon } from "lucide-react"
import { AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { AnimatedNumber } from "@/components/betting/animated-number"
import { PlayerAvatar } from "@/components/bounties/player-avatar"
import { TimeLeft } from "@/components/bounties/time-left"
import { WARRANT_COPY, escapeLine, posterLine } from "@/lib/bounties/copy"
import { WARRANT_HELP, warrantHelp } from "@/lib/bounties/help"
import { minHuntShare } from "@/lib/bounties/rules"
import type { WarrantView } from "@/lib/bounties/types"
import { cn } from "@/lib/utils"

interface WantedPosterProps {
  id?: string
  warrant: WarrantView
  viewerPlayerId: string | null
  canPledge: boolean
  live?: boolean
  highlighted?: boolean
  onPledge: (warrant: WarrantView) => void
}

function backersLine(warrant: WarrantView): string {
  const [first, second, ...rest] = warrant.backers
  if (!first) return "No backers yet"
  if (!second) return `Posted by ${first.name}`
  if (rest.length === 0) return `Posted by ${first.name} and ${second.name}`
  return `Posted by ${first.name}, ${second.name} and ${rest.length} more`
}

export function WantedPoster({ id, warrant, viewerPlayerId, canPledge, live = false, highlighted = false, onPledge }: WantedPosterProps) {
  const reduce = useReducedMotion()
  const isMe = !!viewerPlayerId && warrant.target.playerId === viewerPlayerId
  const legacy = warrant.kind === "legacy"
  const floor = minHuntShare(warrant.price)

  return (
    <motion.article
      id={id}
      layout={reduce ? false : "position"}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      aria-label={`Wanted: ${warrant.target.name}, ${warrant.price} points`}
      className={cn(
        "relative scroll-mt-4 overflow-hidden rounded-2xl border bg-[var(--color-navy)]/70 p-4",
        highlighted ? "border-[var(--color-red-team)]/60 ring-2 ring-[var(--color-red-team)]/25" : "border-[var(--color-red-team)]/25"
      )}
    >
      <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-red-team)]/70 to-transparent" />
      <header className="flex items-center gap-2">
        <span className="font-display text-xs font-bold uppercase tracking-[0.35em] text-[var(--color-red-team)]">Wanted</span>
        <InfoTip help={warrantHelp(warrant, isMe)} side="bottom" align="start" className="-ml-1" />
        {legacy && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">Old terms</span>
        )}
        {live && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-red-team)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-red-team)]">
            <span aria-hidden className="size-1.5 rounded-full bg-[var(--color-red-team)] motion-safe:animate-pulse" />
            On the Rift
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground">
          <HourglassIcon className="size-3.5" aria-hidden />
          <TimeLeft until={warrant.expiresAt} />
        </span>
      </header>

      <div className="mt-3 flex items-center gap-3">
        <div className="relative shrink-0">
          <PlayerAvatar name={warrant.target.name} avatarUrl={warrant.target.avatarUrl} size="lg" className="size-14" />
          <span aria-hidden className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full bg-[var(--color-red-team)] text-[var(--color-navy)] ring-2 ring-[var(--color-navy)]">
            <CrosshairIcon className="size-3.5" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-xl font-semibold text-[var(--color-gold-light)]">{warrant.target.name}</h3>
          <p className="truncate text-xs italic text-muted-foreground">{posterLine(warrant.id)}</p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Price</p>
          <p className="font-display text-3xl font-bold leading-none text-[var(--color-gold)]">
            <AnimatedNumber value={warrant.price} className="tabular-nums" />
            <span className="ml-1 text-sm font-semibold text-[var(--color-gold)]/70">pts</span>
          </p>
        </div>
        {warrant.crownBonus > 0 && (
          <p className="inline-flex items-center gap-1 rounded-full bg-[var(--color-gold)]/10 px-2.5 py-1 text-xs text-[var(--color-gold)]">
            <CrownIcon className="size-3.5" aria-hidden />+{warrant.crownBonus} from the Crown
          </p>
        )}
      </div>

      {warrant.escapes > 0 && (
        <p className="mt-3 text-xs text-[var(--color-gold-light)]/85">
          <span className="font-semibold text-[var(--color-red-team)]">{escapeLine(warrant.id)} {warrant.escapes}x.</span>{" "}
          {warrant.nextEscapeBonus > 0 ? `Next escape adds ${warrant.nextEscapeBonus}.` : "The Crown has matched every pledge."}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <AvatarGroup>
          {warrant.backers.slice(0, 4).map((b) => (
            <PlayerAvatar key={b.userId} name={b.name} avatarUrl={b.avatarUrl} size="sm" />
          ))}
          {warrant.backers.length > 4 && <AvatarGroupCount className="size-6 text-[10px]">+{warrant.backers.length - 4}</AvatarGroupCount>}
        </AvatarGroup>
        <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{backersLine(warrant)}</p>
        {warrant.mine > 0 && <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--color-gold-light)]">You: {warrant.mine}</span>}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-card/60 p-3 text-xs leading-relaxed text-[var(--color-gold-light)]/85">
        <p className="flex items-start gap-2">
          <ScrollTextIcon className="mt-0.5 size-3.5 shrink-0 text-[var(--color-gold)]" aria-hidden />
          {legacy ? (
            <span>{WARRANT_COPY.legacy} ({warrant.legacyPayout} points)</span>
          ) : isMe ? (
            <span>That is your head. Win your games and the Crown pays you in fear (and makes it pricier).</span>
          ) : (
            <span>
              {live ? `${warrant.target.name} is playing right now: this game settles it. ` : `Beat ${warrant.target.name} in a game. `}
              The winning team splits the {warrant.price}
              {floor > 0 ? ` (at least ${floor} each).` : "."}
            </span>
          )}
        </p>
      </div>

      {!legacy && !isMe && canPledge && (
        <div className="mt-3 flex items-center gap-2.5">
          <Button
            onClick={() => onPledge(warrant)}
            className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--color-red-team)]/40 bg-[var(--color-red-team)]/15 font-semibold text-[var(--color-gold-light)] hover:bg-[var(--color-red-team)]/25"
          >
            <PlusIcon aria-hidden />
            {WARRANT_COPY.addTo}
          </Button>
          <InfoTip help={WARRANT_HELP.pledge} align="end" />
        </div>
      )}
    </motion.article>
  )
}
