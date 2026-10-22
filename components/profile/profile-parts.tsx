"use client"

import type { ReactNode } from "react"
import {
  CrosshairIcon,
  CrownIcon,
  HeartCrackIcon,
  HeartHandshakeIcon,
  MicIcon,
  ScaleIcon,
  SkullIcon,
  SwordIcon,
  SwordsIcon,
  type LucideIcon,
} from "lucide-react"
import { LaneIcon } from "@/components/lane-icon"
import { ChampionIcon, PlayerAvatar } from "@/components/pages/avatars"
import { formatNumber, formatPercent, formatShortDay, plural } from "@/components/pages/format"
import { FormDots, rateTone, StreakChip } from "@/components/pages/indicators"
import { StatTile } from "@/components/pages/stat-tile"
import { ProfileTrigger } from "@/components/profile/profile-provider"
import { InfoTip } from "@/components/ui/info-tip"
import { ALL_ROLES, ROLE_LABELS } from "@/lib/champions"
import type { HelpEntry } from "@/lib/help"
import { PROFILE_HELP } from "@/lib/profiles/help"
import {
  PROFILE_RULES,
  type PlayerProfileResponse,
  type ProfileBond,
  type ProfileBounty,
  type ProfileChampion,
  type ProfileGame,
  type ProfileLane,
  type ProfileRivals,
  type ProfileSeat,
} from "@/lib/profiles/types"
import { cn } from "@/lib/utils"

export function Eyebrow({ children, help, className }: { children: ReactNode; help?: HelpEntry; className?: string }) {
  return (
    <h3 className={cn("flex items-center gap-1 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase", className)}>
      {children}
      {help ? <InfoTip help={help} /> : null}
    </h3>
  )
}

export function BountyBanner({ bounty, name, className }: { bounty: ProfileBounty | null; name: string; className?: string }) {
  if (!bounty) return null
  return (
    <div
      className={cn(
        "flex min-h-10 items-center gap-2.5 rounded-xl bg-[var(--color-red-team)]/12 px-3 py-2 text-sm ring-1 ring-[var(--color-red-team)]/40",
        className
      )}
    >
      <CrosshairIcon aria-hidden className="size-4 shrink-0 text-[var(--color-red-team)]" />
      <span className="min-w-0 flex-1 text-[var(--color-gold-light)]">
        <span className="font-display font-semibold text-[var(--color-red-team)]">Wanted: </span>
        {formatNumber(bounty.price)} points on {name}&apos;s head
        <span className="text-muted-foreground">
          {" "}
          · {plural(bounty.backers, "backer")}
          {bounty.escapes > 0 ? ` · escaped ${plural(bounty.escapes, "time")}` : ""}
        </span>
      </span>
    </div>
  )
}

export function rankLine(rank: PlayerProfileResponse["rank"]): string {
  if (!rank) return "No purse on the books"
  if (rank.rank === 1) return "The treasury bows."
  if (rank.rank <= 3) return "On the podium."
  if (rank.rank === rank.of) return "Rock bottom. Nice view."
  if (rank.rank > rank.of - 3) return "Flirting with the bottom."
  return rank.source === "archive" ? "Final standing" : "By point balance"
}

export function StatGrid({ profile, className }: { profile: PlayerProfileResponse; className?: string }) {
  const { record, allTime, rank, praise, scope } = profile
  const scoped = scope.key !== "all"
  const rumour = record.games > 0 && record.games < PROFILE_RULES.rateMinGames
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <StatTile
        icon={SwordsIcon}
        label="Record"
        value={
          <span className="tabular-nums">
            <span className="text-emerald-300">{record.wins}</span>
            <span className="mx-1 text-muted-foreground">-</span>
            <span className="text-rose-300">{record.losses}</span>
          </span>
        }
        hint={scoped ? `All time ${allTime.wins}-${allTime.losses}` : plural(record.games, "game")}
      />
      <StatTile
        icon={ScaleIcon}
        label="Win rate"
        value={
          <span className="flex items-center gap-1">
            <span className={cn("tabular-nums", record.games ? rateTone(record.winRate) : "text-muted-foreground")}>
              {record.games ? formatPercent(record.winRate) : "-"}
            </span>
            <InfoTip help={PROFILE_HELP.winRate} />
          </span>
        }
        hint={rumour ? `A rumour: under ${PROFILE_RULES.rateMinGames} games` : plural(record.games, "game")}
      />
      <StatTile
        icon={CrownIcon}
        label="Treasury"
        value={
          <span className="flex items-center gap-1">
            <span className="tabular-nums">{rank ? `#${rank.rank}` : "-"}</span>
            {rank ? <span className="text-sm font-normal text-muted-foreground">of {rank.of}</span> : null}
            <InfoTip help={PROFILE_HELP.rank} />
          </span>
        }
        hint={rank ? `${formatNumber(rank.balance)} points · ${rankLine(rank)}` : rankLine(rank)}
      />
      <StatTile
        icon={MicIcon}
        label="Devotion"
        value={
          <span className="flex items-center gap-1">
            <span className="tabular-nums">{praise ? formatNumber(praise.total) : "-"}</span>
            <InfoTip help={PROFILE_HELP.praise} />
          </span>
        }
        hint={
          praise
            ? praise.total === 0
              ? "Not one verse. Salaxe noticed."
              : `${plural(praise.songs, "song")}, ${plural(praise.kisses, "kiss", "kisses")}`
            : "No purse, no voice"
        }
      />
    </div>
  )
}

export function FormLine({ profile, className }: { profile: PlayerProfileResponse; className?: string }) {
  if (profile.record.games === 0) return null
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5", className)}>
      <Eyebrow>Form</Eyebrow>
      <FormDots form={profile.form} />
      <StreakChip streak={profile.streak} />
      <span className="text-xs text-muted-foreground">
        Best run {plural(profile.bestWinStreak, "win")}
        {profile.lastPlayedAt ? ` · last seen ${formatShortDay(profile.lastPlayedAt)}` : ""}
      </span>
    </div>
  )
}

export function LaneBreakdown({ lanes, className }: { lanes: ProfileLane[]; className?: string }) {
  const all = ALL_ROLES.map((lane) => lanes.find((l) => l.lane === lane) ?? { lane, games: 0, wins: 0, winRate: 0 })
  const main = lanes[0]?.lane ?? null
  return (
    <ul className={cn("grid grid-cols-5 gap-1.5", className)}>
      {all.map((lane) => (
        <li
          key={lane.lane}
          className={cn(
            "flex min-w-0 flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-center",
            lane.lane === main ? "border-[var(--color-gold)]/40 bg-[var(--color-gold)]/[0.06]" : "border-[var(--color-gold)]/10"
          )}
        >
          <LaneIcon lane={lane.lane} size={18} className="text-[var(--color-gold)]/80" />
          <span className="text-[10px] text-muted-foreground">{ROLE_LABELS[lane.lane]}</span>
          <span className={cn("text-xs font-semibold tabular-nums", lane.games ? rateTone(lane.winRate) : "text-muted-foreground")}>
            {lane.games ? `${Math.round(lane.winRate)}%` : "-"}
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums">{lane.games}g</span>
        </li>
      ))}
    </ul>
  )
}

export function ChampionStrip({ champions, limit, className }: { champions: ProfileChampion[]; limit?: number; className?: string }) {
  const shown = limit ? champions.slice(0, limit) : champions
  if (shown.length === 0) return null
  return (
    <ul className={cn("grid grid-cols-4 gap-2 sm:grid-cols-8", limit && limit <= 4 && "sm:grid-cols-4", className)}>
      {shown.map((c) => (
        <li key={c.name} className="flex min-w-0 flex-col items-center gap-1 text-center">
          <ChampionIcon name={c.name} internal={c.internal} size={44} />
          <span className="w-full truncate text-[11px] text-[var(--color-gold-light)]/85">{c.name}</span>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {c.games}g · <span className={rateTone(c.winRate)}>{Math.round(c.winRate)}%</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

interface BondCardProps {
  icon: LucideIcon
  label: string
  bond: ProfileBond
  line: string
  tone: "good" | "bad"
}

function BondCard({ icon: Icon, label, bond, line, tone }: BondCardProps) {
  return (
    <ProfileTrigger
      playerId={bond.player.id}
      name={bond.player.name}
      className="flex w-full items-center gap-2.5 rounded-xl border border-[var(--color-gold)]/12 bg-[var(--color-navy)]/50 p-2.5 hover:border-[var(--color-gold)]/30 hover:bg-[var(--color-gold)]/[0.04] before:inset-0"
    >
      <span className="relative shrink-0">
        <PlayerAvatar name={bond.player.name} src={bond.player.avatarUrl} size="md" />
        <span
          className={cn(
            "absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full ring-2 ring-card",
            tone === "good" ? "bg-emerald-400/20 text-emerald-300" : "bg-rose-400/20 text-rose-300"
          )}
        >
          <Icon className="size-3" aria-hidden />
        </span>
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{label}</span>
        <span className="block truncate text-sm font-semibold text-[var(--color-gold-light)]">{bond.player.name}</span>
        <span className="block truncate text-xs text-muted-foreground">{line}</span>
      </span>
    </ProfileTrigger>
  )
}

export function RivalCards({ rivals, full = false, className }: { rivals: ProfileRivals; full?: boolean; className?: string }) {
  const { bestDuo, nemesis, worstDuo, prey } = rivals
  const cards = [
    bestDuo && (
      <BondCard
        key="duo"
        icon={HeartHandshakeIcon}
        label="Soulmate"
        bond={bestDuo}
        line={`${formatPercent(bestDuo.winRate)} together over ${plural(bestDuo.games, "game")}`}
        tone="good"
      />
    ),
    nemesis && (
      <BondCard
        key="nemesis"
        icon={SkullIcon}
        label="Arch-nemesis"
        bond={nemesis}
        line={`Won ${nemesis.losses} of ${nemesis.games} head to head`}
        tone="bad"
      />
    ),
    full && prey && (
      <BondCard key="prey" icon={SwordIcon} label="Favourite victim" bond={prey} line={`Lost ${prey.wins} of ${prey.games} to him`} tone="good" />
    ),
    full && worstDuo && (
      <BondCard
        key="omen"
        icon={HeartCrackIcon}
        label="Bad omen"
        bond={worstDuo}
        line={`${formatPercent(worstDuo.winRate)} together. Queue apart.`}
        tone="bad"
      />
    ),
  ].filter(Boolean)

  if (cards.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No soulmate, no nemesis yet. It takes {PROFILE_RULES.duoMinGames} games together, or {PROFILE_RULES.rivalMinGames} against, to make it
        personal.
      </p>
    )
  }
  return <div className={cn("grid gap-2 sm:grid-cols-2", className)}>{cards}</div>
}

export function BondList({ bonds, versus, className }: { bonds: ProfileBond[]; versus: boolean; className?: string }) {
  if (bonds.length === 0) return <p className={cn("text-sm text-muted-foreground", className)}>Nobody yet.</p>
  return (
    <ol className={cn("divide-y divide-[var(--color-gold)]/8", className)}>
      {bonds.map((bond) => (
        <li key={bond.player.id}>
          <ProfileTrigger
            playerId={bond.player.id}
            name={bond.player.name}
            className="flex min-h-12 w-full items-center gap-3 py-1.5 before:inset-0"
          >
            <PlayerAvatar name={bond.player.name} src={bond.player.avatarUrl} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-gold-light)]">{bond.player.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{plural(bond.games, "game")}</span>
            <span className="w-14 shrink-0 text-right text-xs tabular-nums">
              <span className="text-emerald-300">{bond.wins}</span>
              <span className="text-muted-foreground">-</span>
              <span className="text-rose-300">{bond.losses}</span>
            </span>
            <span className={cn("w-12 shrink-0 text-right text-sm font-semibold tabular-nums", rateTone(bond.winRate))}>
              {Math.round(bond.winRate)}%
            </span>
          </ProfileTrigger>
          <span className="sr-only">{versus ? "Record against them" : "Record together"}</span>
        </li>
      ))}
    </ol>
  )
}

function ResultPill({ won }: { won: boolean }) {
  return (
    <span
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-md text-[11px] font-bold",
        won ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/30" : "bg-rose-400/12 text-rose-300 ring-1 ring-rose-400/25"
      )}
    >
      {won ? "W" : "L"}
      <span className="sr-only">{won ? "Win" : "Loss"}</span>
    </span>
  )
}

function SideTag({ side }: { side: ProfileGame["side"] }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase",
        side === "blue" ? "bg-[var(--color-blue-team)]/15 text-sky-300" : "bg-[var(--color-red-team)]/15 text-rose-300"
      )}
    >
      {side}
    </span>
  )
}

export function GameRow({ game }: { game: ProfileGame }) {
  return (
    <li className="flex min-h-12 items-center gap-2.5 py-1.5">
      <ResultPill won={game.won} />
      <ChampionIcon name={game.champion} internal={game.internal} size={36} dimmed={!game.won} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-gold-light)]">{game.champion}</p>
        <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          <LaneIcon lane={game.lane} size={12} className="shrink-0" />
          {ROLE_LABELS[game.lane]} · {formatShortDay(game.playedAt)}
        </p>
      </div>
      <span className="flex shrink-0 -space-x-1.5" aria-label={`Allies: ${game.teammates.map((t) => t.name).join(", ")}`}>
        {game.teammates.map((mate) => (
          <PlayerAvatar key={mate.playerId} name={mate.name} src={mate.avatarUrl} size="xs" className="ring-2 ring-popover" />
        ))}
      </span>
    </li>
  )
}

function SeatLine({ seat }: { seat: ProfileSeat }) {
  return (
    <li>
      <ProfileTrigger playerId={seat.playerId} name={seat.name} className="flex min-h-10 w-full items-center gap-2 py-1 before:inset-0">
        <ChampionIcon name={seat.champion} internal={seat.internal} size={26} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] leading-tight font-medium text-[var(--color-gold-light)]">{seat.name}</span>
          <span className="block truncate text-[11px] leading-tight text-muted-foreground">{seat.champion}</span>
        </span>
        <LaneIcon lane={seat.lane} size={13} className="shrink-0 text-[var(--color-gold)]/60" />
      </ProfileTrigger>
    </li>
  )
}

export function GameCard({ game }: { game: ProfileGame }) {
  return (
    <li
      className={cn(
        "rounded-2xl border bg-card p-3 sm:p-4",
        game.won ? "border-emerald-400/20" : "border-rose-400/15"
      )}
    >
      <div className="flex items-center gap-2.5">
        <ResultPill won={game.won} />
        <ChampionIcon name={game.champion} internal={game.internal} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-semibold text-[var(--color-gold-light)]">{game.champion}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <LaneIcon lane={game.lane} size={12} className="shrink-0" />
            {ROLE_LABELS[game.lane]}
            <SideTag side={game.side} />
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{formatShortDay(game.playedAt)}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 border-t border-[var(--color-gold)]/10 pt-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-emerald-300/80 uppercase">Allies</p>
          <ul>
            {game.teammates.map((seat) => (
              <SeatLine key={seat.playerId} seat={seat} />
            ))}
          </ul>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold tracking-[0.16em] text-rose-300/80 uppercase">Foes</p>
          <ul>
            {game.opponents.map((seat) => (
              <SeatLine key={seat.playerId} seat={seat} />
            ))}
          </ul>
        </div>
      </div>
    </li>
  )
}

interface IdentityBlockProps {
  profile: PlayerProfileResponse
  // The rendered name heading: a dialog title in the sheet, the page h1 on the full page.
  heading: ReactNode
  // The primary title, worn under the name.
  epithet?: ReactNode
  large?: boolean
  className?: string
}

export function IdentityBlock({ profile, heading, epithet, large = false, className }: IdentityBlockProps) {
  const { player, allTime } = profile
  return (
    <div className={cn("flex min-w-0 items-center gap-3 sm:gap-4", className)}>
      <PlayerAvatar
        name={player.name}
        src={player.avatarUrl}
        size="xl"
        ring={player.userId ? "gold" : "silver"}
        className={large ? "size-16 sm:size-20" : "size-14"}
      />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.22em] text-muted-foreground uppercase">
          Court file
          {!player.isActive ? <span className="rounded bg-muted px-1 py-px tracking-wider text-muted-foreground">Benched</span> : null}
        </p>
        {heading}
        {epithet}
        <p className="truncate text-sm text-muted-foreground">
          {player.username ? `@${player.username}` : "Unclaimed seat"}
          {allTime.games > 0 ? ` · ${plural(allTime.games, "game")} all time` : " · fresh off the boat"}
        </p>
      </div>
    </div>
  )
}
