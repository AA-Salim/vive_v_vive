"use client"

import { HeartCrackIcon, HeartHandshakeIcon, SkullIcon, SwordIcon, type LucideIcon } from "lucide-react"
import { LaneIcon } from "@/components/lane-icon"
import { ChampionIcon, PlayerAvatar } from "@/components/pages/avatars"
import { formatShortDay, plural } from "@/components/pages/format"
import { FormDots, rateTone, StreakChip, WinRateMeter } from "@/components/pages/indicators"
import { ALL_ROLES, ROLE_LABELS } from "@/lib/champions"
import type { PlayerDetailResponse, PlayerRef } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

const rate = (wins: number, games: number) => (games > 0 ? Math.round((wins / games) * 100) : 0)

function Relation({
  icon: Icon,
  label,
  player,
  line,
  tone,
}: {
  icon: LucideIcon
  label: string
  player: PlayerRef
  line: string
  tone: "good" | "bad"
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-[var(--color-gold)]/12 bg-[var(--color-navy)]/50 p-2.5">
      <div className="relative shrink-0">
        <PlayerAvatar name={player.name} src={player.avatarUrl} size="md" />
        <span
          className={cn(
            "absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full ring-2 ring-card",
            tone === "good" ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-400/20 text-rose-300"
          )}
        >
          <Icon className="size-3" aria-hidden />
        </span>
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{label}</p>
        <p className="truncate text-sm font-semibold text-[var(--color-gold-light)]">{player.name}</p>
        <p className="truncate text-xs text-muted-foreground">{line}</p>
      </div>
    </div>
  )
}

export function PlayerRecord({ detail, perspective = "you" }: { detail: PlayerDetailResponse; perspective?: "you" | "them" }) {
  const { player, recent, champions, nemesis, prey, bestDuo, worstDuo } = detail
  const you = perspective === "you"
  const lanes = ALL_ROLES.map((lane) => player.lanes.find((l) => l.lane === lane) ?? { lane, games: 0, wins: 0 })
  const mainLane = player.lanes[0]?.lane ?? null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Record</p>
          <p className="font-display text-3xl leading-none font-semibold text-[var(--color-gold-light)] tabular-nums">
            <span className="text-emerald-300">{player.wins}</span>
            <span className="mx-1 text-muted-foreground">-</span>
            <span className="text-rose-300">{player.losses}</span>
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Win rate</p>
          <WinRateMeter rate={player.winRate} games={player.games} />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Form</p>
          <span className="flex items-center gap-2">
            <FormDots form={player.form} />
            <StreakChip streak={player.streak} />
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {plural(player.games, "game")} · best run {plural(player.bestWinStreak, "win")} · worst {plural(player.worstLossStreak, "loss", "losses")}
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Lanes</h3>
        <ul className="grid grid-cols-5 gap-1.5">
          {lanes.map((lane) => (
            <li
              key={lane.lane}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center",
                lane.lane === mainLane ? "border-[var(--color-gold)]/40 bg-[var(--color-gold)]/[0.06]" : "border-[var(--color-gold)]/10"
              )}
            >
              <LaneIcon lane={lane.lane} size={18} className="text-[var(--color-gold)]/80" />
              <span className="text-[10px] text-muted-foreground">{ROLE_LABELS[lane.lane]}</span>
              <span className={cn("text-xs font-semibold tabular-nums", lane.games ? rateTone(rate(lane.wins, lane.games)) : "text-muted-foreground")}>
                {lane.games ? `${rate(lane.wins, lane.games)}%` : "-"}
              </span>
              <span className="text-[10px] text-muted-foreground tabular-nums">{lane.games}g</span>
            </li>
          ))}
        </ul>
      </div>

      {champions.length > 0 ? (
        <div>
          <h3 className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {you ? "The dice keep giving you" : "The dice keep giving him"}
          </h3>
          <ul className="grid grid-cols-4 gap-2 sm:grid-cols-8">
            {champions.map((c) => (
              <li key={c.name} className="flex min-w-0 flex-col items-center gap-1 text-center">
                <ChampionIcon name={c.name} internal={c.internal} size={44} />
                <span className="w-full truncate text-[11px] text-[var(--color-gold-light)]/85">{c.name}</span>
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {c.wins}W {c.games - c.wins}L
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {nemesis || prey || bestDuo || worstDuo ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {nemesis ? (
            <Relation
              icon={SkullIcon}
              label="Nemesis"
              player={nemesis.player}
              line={`Won ${nemesis.losses} of ${nemesis.games} against ${you ? "you" : "him"}.`}
              tone="bad"
            />
          ) : null}
          {prey ? (
            <Relation
              icon={SwordIcon}
              label="Favourite victim"
              player={prey.player}
              line={`Lost ${prey.wins} of ${prey.games} against ${you ? "you" : "him"}.`}
              tone="good"
            />
          ) : null}
          {bestDuo ? (
            <Relation
              icon={HeartHandshakeIcon}
              label="Soulmate"
              player={bestDuo.player}
              line={`${bestDuo.winRate}% together over ${plural(bestDuo.games, "game")}.`}
              tone="good"
            />
          ) : null}
          {worstDuo ? (
            <Relation
              icon={HeartCrackIcon}
              label="Bad omen"
              player={worstDuo.player}
              line={`${worstDuo.winRate}% together. Queue apart.`}
              tone="bad"
            />
          ) : null}
        </div>
      ) : null}

      {recent.length > 0 ? (
        <div>
          <h3 className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Last {recent.length} games</h3>
          <ol className="flex flex-wrap gap-1.5" aria-label="Recent games, newest first">
            {recent.map((game) => (
              <li
                key={game.gameId}
                className="relative"
                title={`${game.won ? "Win" : "Loss"} · ${game.champion} ${ROLE_LABELS[game.lane]} · ${formatShortDay(game.playedAt)}`}
              >
                <ChampionIcon
                  name={game.champion}
                  internal={game.internal}
                  size={40}
                  className={cn("ring-2", game.won ? "ring-emerald-400/70" : "ring-rose-400/60")}
                  dimmed={!game.won}
                />
                <span className="sr-only">
                  {game.won ? "Win" : "Loss"} with {game.champion} in {ROLE_LABELS[game.lane]} on {formatShortDay(game.playedAt)}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  )
}
