"use client"

import { ChevronDownIcon, CoinsIcon, ScrollTextIcon, SkullIcon, StarIcon, TrophyIcon } from "lucide-react"
import { LaneIcon } from "@/components/lane-icon"
import { ChampionIcon } from "@/components/pages/avatars"
import { formatNumber, formatTime } from "@/components/pages/format"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { InfoTip } from "@/components/ui/info-tip"
import { ALL_ROLES, ROLE_LABELS } from "@/lib/champions"
import { VERDICT_HELP } from "@/lib/pages/help"
import type { HistoryGame, HistoryPlayer } from "@/lib/pages/types"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ProfileTrigger } from "@/components/profile/profile-provider"

const SIDE_LABEL: Record<Side, string> = { blue: "Blue", red: "Red" }
const SIDE_TEXT: Record<Side, string> = { blue: "text-[var(--color-blue-team)]", red: "text-[var(--color-red-team)]" }
const SIDE_CHIP: Record<Side, string> = {
  blue: "bg-[var(--color-blue-team)]/15 text-[var(--color-blue-team)] ring-[var(--color-blue-team)]/35",
  red: "bg-[var(--color-red-team)]/15 text-[var(--color-red-team)] ring-[var(--color-red-team)]/35",
}
const MODE_LABEL: Record<string, string> = { coach_draft: "Coach draft", vainqueur: "Winner stays" }

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-[var(--color-navy)]/70 px-2 text-[11px] font-medium text-[var(--color-gold-light)]/80 ring-1 ring-[var(--color-gold)]/15",
        className
      )}
    >
      {children}
    </span>
  )
}

const SIDE_WASH: Record<Side, string> = {
  blue: "bg-[var(--color-blue-team)]/[0.07] ring-[var(--color-blue-team)]/20",
  red: "bg-[var(--color-red-team)]/[0.07] ring-[var(--color-red-team)]/20",
}

// Rendered inside the card's toggle button, so only phrasing elements (spans) are allowed here.
function TeamStrip({ side, players, won, highlight }: { side: Side; players: HistoryPlayer[]; won: boolean; highlight: ReadonlySet<string> }) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-xl p-1.5 md:flex-col md:items-stretch md:p-2.5",
        won ? cn("ring-1", SIDE_WASH[side]) : "ring-1 ring-transparent"
      )}
    >
      <span className="flex w-10 shrink-0 items-center gap-1 md:w-auto">
        <span className={cn("text-[10px] font-bold tracking-[0.14em] uppercase", SIDE_TEXT[side], !won && "opacity-60")}>{SIDE_LABEL[side]}</span>
        {won ? <TrophyIcon className="hidden size-3.5 text-[var(--color-gold)] md:block" aria-hidden /> : null}
      </span>
      <span className="flex min-w-0 flex-1 items-center gap-1.5 md:grid md:grid-cols-5 md:gap-2">
        {players.map((p) => (
          <span key={p.playerId} className="min-w-0 md:flex md:flex-col md:items-center md:gap-1">
            <ChampionIcon
              name={`${p.champion} (${p.name})`}
              internal={p.internal}
              size={44}
              side={won ? side : null}
              dimmed={!won}
              className={cn("size-9 sm:size-10 md:size-11", highlight.has(p.playerId) && "opacity-100 ring-2 ring-[var(--color-gold)] grayscale-0")}
            />
            <span
              className={cn(
                "hidden w-full truncate text-center text-[11px] md:block",
                highlight.has(p.playerId) ? "font-semibold text-[var(--color-gold)]" : "text-muted-foreground"
              )}
            >
              {p.name}
            </span>
          </span>
        ))}
      </span>
    </span>
  )
}

function Matchups({ game, highlight }: { game: HistoryGame; highlight: ReadonlySet<string> }) {
  const seat = (side: Side, lane: string) => game.players.find((p) => p.side === side && p.lane === lane)
  return (
    <ol className="mt-3 space-y-1.5 border-t border-[var(--color-gold)]/10 pt-3" aria-label="Lane matchups">
      {ALL_ROLES.map((lane) => {
        const blue = seat("blue", lane)
        const red = seat("red", lane)
        if (!blue && !red) return null
        return (
          <li key={lane} className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            {[blue, red].map((p, i) => (
              <div key={i} className={cn("flex min-w-0 items-center gap-2", i === 0 ? "order-1 justify-end text-right" : "order-3")}>
                {p ? (
                  <>
                    <div className={cn("min-w-0", i === 0 ? "order-1" : "order-2")}>
                      <p className={cn("truncate text-sm font-medium", highlight.has(p.playerId) ? "text-[var(--color-gold)]" : "text-[var(--color-gold-light)]")}>
                        <ProfileTrigger playerId={p.playerId} name={p.name}>{p.name}</ProfileTrigger>
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{p.champion}</p>
                    </div>
                    <ChampionIcon
                      name={p.champion}
                      internal={p.internal}
                      size={32}
                      side={p.side}
                      dimmed={p.side !== game.winner}
                      className={i === 0 ? "order-2" : "order-1"}
                    />
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Empty seat</span>
                )}
              </div>
            ))}
            <span className="order-2 grid size-7 place-items-center rounded-full bg-[var(--color-navy)] ring-1 ring-[var(--color-gold)]/15" title={ROLE_LABELS[lane]}>
              <LaneIcon lane={lane} size={14} className="text-[var(--color-gold)]/70" />
              <span className="sr-only">{ROLE_LABELS[lane]}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

interface MatchCardProps {
  game: HistoryGame
  defaultOpen?: boolean
  // One player (the history filter) or several (the two rivals of a feud).
  highlight?: string | readonly string[] | null
}

export function MatchCard({ game, defaultOpen = false, highlight = null }: MatchCardProps) {
  const marked = new Set(typeof highlight === "string" ? [highlight] : (highlight ?? []))
  const blue = game.players.filter((p) => p.side === "blue")
  const red = game.players.filter((p) => p.side === "red")
  const mode = game.session ? MODE_LABEL[game.session.mode] : undefined
  const summary = [
    `${SIDE_LABEL[game.winner]} victory at ${formatTime(game.playedAt)}`,
    game.verdict?.mvp.length ? `MVP ${game.verdict.mvp.join(" and ")}` : null,
    game.verdict?.inter.length ? `Inter ${game.verdict.inter.join(" and ")}` : null,
    game.players.length > 0 ? "show lane matchups" : "roster lost",
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-2xl border border-[var(--color-gold)]/12 bg-card transition-colors hover:border-[var(--color-gold)]/25">
      <CollapsibleTrigger
        aria-label={summary}
        className="group/trigger block w-full rounded-2xl p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-4"
      >
        <span className="flex flex-wrap items-center gap-1.5">
          <span className={cn("inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold tracking-wide uppercase ring-1", SIDE_CHIP[game.winner])}>
            {SIDE_LABEL[game.winner]} victory
          </span>
          <time dateTime={game.playedAt} className="text-xs text-muted-foreground tabular-nums">
            {formatTime(game.playedAt)}
          </time>
          {mode ? <Chip>{mode}</Chip> : null}
          {game.session && game.session.pool > 0 ? (
            <Chip>
              <CoinsIcon className="size-3 text-[var(--color-gold)]" aria-hidden />
              {formatNumber(game.session.pool)}
              <span className="hidden sm:inline"> wagered · {game.session.bettors} bettors</span>
            </Chip>
          ) : null}
          {game.session && game.session.decrees > 0 ? (
            <Chip>
              <ScrollTextIcon className="size-3 text-[var(--color-gold)]" aria-hidden />
              {game.session.decrees}
              <span className="hidden sm:inline"> {game.session.decrees === 1 ? "decree" : "decrees"}</span>
            </Chip>
          ) : null}
          <ChevronDownIcon className="ml-auto size-4 text-muted-foreground transition-transform group-data-[panel-open]/trigger:rotate-180" aria-hidden />
        </span>
        {game.verdict && (game.verdict.mvp.length > 0 || game.verdict.inter.length > 0) ? (
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            {game.verdict.mvp.length > 0 ? (
              <Chip className="text-[var(--color-gold)] ring-[var(--color-gold)]/30">
                <StarIcon className="size-3" aria-hidden />
                MVP: {game.verdict.mvp.join(" & ")}
              </Chip>
            ) : null}
            {game.verdict.inter.length > 0 ? (
              <Chip className="text-rose-300 ring-rose-400/30">
                <SkullIcon className="size-3" aria-hidden />
                Inter: {game.verdict.inter.join(" & ")}
              </Chip>
            ) : null}
            <InfoTip help={VERDICT_HELP} />
          </span>
        ) : null}
        {game.players.length === 0 ? (
          <span className="mt-3 block text-sm text-muted-foreground">The roster of this game was lost to the void.</span>
        ) : (
          <span className="mt-3 grid gap-1.5 md:grid-cols-2 md:gap-3">
            <TeamStrip side="blue" players={blue} won={game.winner === "blue"} highlight={marked} />
            <TeamStrip side="red" players={red} won={game.winner === "red"} highlight={marked} />
          </span>
        )}
      </CollapsibleTrigger>
      {game.players.length > 0 ? (
        <CollapsibleContent className="px-3 pb-3 sm:px-4 sm:pb-4">
          <Matchups game={game} highlight={marked} />
        </CollapsibleContent>
      ) : null}
    </Collapsible>
  )
}
