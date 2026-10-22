"use client"

import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"
import { LaneIcon } from "@/components/lane-icon"
import { ChampionIcon, PlayerAvatar } from "@/components/pages/avatars"
import { FormDots, StreakChip, WinRateMeter } from "@/components/pages/indicators"
import { PlayerTitles } from "@/components/titles/player-titles"
import { ROLE_LABELS } from "@/lib/champions"
import type { PlayerRef, PlayerStat } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

export type SortKey = "name" | "games" | "wins" | "losses" | "winRate" | "streak"

export interface SortState {
  key: SortKey
  ascending: boolean
}

const streakValue = (p: PlayerStat) => (p.streak ? (p.streak.outcome === "W" ? p.streak.count : -p.streak.count) : 0)

export function sortPlayers(players: PlayerStat[], sort: SortState): PlayerStat[] {
  const factor = sort.ascending ? 1 : -1
  return [...players].sort((x, y) => {
    const primary =
      sort.key === "name"
        ? x.name.localeCompare(y.name)
        : sort.key === "streak"
          ? streakValue(x) - streakValue(y)
          : x[sort.key] - y[sort.key]
    return factor * primary || y.games - x.games || x.name.localeCompare(y.name)
  })
}

const COLUMNS: { key: SortKey; label: string; className: string }[] = [
  { key: "name", label: "Player", className: "text-left" },
  { key: "games", label: "Games", className: "text-right" },
  { key: "wins", label: "W", className: "text-right" },
  { key: "losses", label: "L", className: "text-right" },
  { key: "winRate", label: "Win rate", className: "text-left" },
  { key: "streak", label: "Form", className: "text-left" },
]

function MainLane({ player }: { player: PlayerStat }) {
  const lane = player.lanes[0]
  if (!lane) return <span className="text-muted-foreground">-</span>
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-gold-light)]/80">
      <LaneIcon lane={lane.lane} size={14} className="text-[var(--color-gold)]/70" />
      {ROLE_LABELS[lane.lane]}
      <span className="text-xs text-muted-foreground tabular-nums">{lane.games}g</span>
    </span>
  )
}

function TopChampions({ player }: { player: PlayerStat }) {
  return (
    <span className="flex items-center -space-x-1.5">
      {player.champions.map((c) => (
        <ChampionIcon key={c.name} name={`${c.name}: ${c.wins}W ${c.games - c.wins}L`} internal={c.internal} size={28} rounded="full" className="ring-2 ring-card" />
      ))}
    </span>
  )
}

interface ListProps {
  players: PlayerStat[]
  sort: SortState
  onSort: (key: SortKey) => void
  onOpen: (player: PlayerRef) => void
}

export function StatsTable({ players, sort, onSort, onOpen }: ListProps) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-gold)]/15 bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Player statistics, sorted by {COLUMNS.find((c) => c.key === sort.key)?.label}</caption>
        <thead>
          <tr className="border-b border-[var(--color-gold)]/10 text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
            <th scope="col" className="w-10 px-3 py-2.5 text-center font-semibold">
              #
            </th>
            {COLUMNS.map((col) => {
              const active = sort.key === col.key
              return (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={active ? (sort.ascending ? "ascending" : "descending") : "none"}
                  className={cn("px-2 py-1.5 font-semibold", col.className)}
                >
                  <button
                    type="button"
                    onClick={() => onSort(col.key)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1 rounded-md px-1.5 uppercase outline-none hover:text-[var(--color-gold-light)] focus-visible:ring-2 focus-visible:ring-ring/50",
                      active && "text-[var(--color-gold)]"
                    )}
                  >
                    {col.label}
                    {active ? sort.ascending ? <ArrowUpIcon className="size-3" aria-hidden /> : <ArrowDownIcon className="size-3" aria-hidden /> : null}
                  </button>
                </th>
              )
            })}
            <th scope="col" className="hidden px-2 py-2.5 text-left font-semibold lg:table-cell">
              Main lane
            </th>
            <th scope="col" className="hidden px-3 py-2.5 text-left font-semibold lg:table-cell">
              Most dealt
            </th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, index) => (
            <tr key={p.id} className="border-b border-[var(--color-gold)]/[0.06] transition-colors last:border-0 hover:bg-[var(--color-gold)]/[0.03]">
              <td className="px-3 py-2 text-center font-display text-sm font-semibold text-muted-foreground tabular-nums">{index + 1}</td>
              <td className="px-2 py-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <PlayerAvatar name={p.name} src={p.avatarUrl} size="sm" />
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() => onOpen(p)}
                      className="block max-w-full truncate rounded-sm text-left font-semibold text-[var(--color-gold-light)] outline-none hover:text-[var(--color-gold)] focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      {p.name}
                    </button>
                    <PlayerTitles playerId={p.id} />
                  </div>
                </div>
              </td>
              <td className="px-3 py-2 text-right text-[var(--color-gold-light)]/80 tabular-nums">{p.games}</td>
              <td className="px-3 py-2 text-right text-emerald-300 tabular-nums">{p.wins}</td>
              <td className="px-3 py-2 text-right text-rose-300 tabular-nums">{p.losses}</td>
              <td className="px-2 py-2">
                <WinRateMeter rate={p.winRate} games={p.games} />
              </td>
              <td className="px-2 py-2">
                <span className="flex items-center gap-2">
                  <FormDots form={p.form} />
                  <StreakChip streak={p.streak} />
                </span>
              </td>
              <td className="hidden px-2 py-2 lg:table-cell">
                <MainLane player={p} />
              </td>
              <td className="hidden px-3 py-2 lg:table-cell">
                <TopChampions player={p} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function StatsCards({ players, onOpen }: Omit<ListProps, "sort" | "onSort">) {
  return (
    <ol className="space-y-2" aria-label="Players">
      {players.map((p, index) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onOpen(p)}
            className="flex w-full flex-col gap-2.5 rounded-2xl border border-[var(--color-gold)]/12 bg-card p-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <span className="flex w-full min-w-0 items-center gap-2.5">
              <span className="w-5 shrink-0 text-center font-display text-sm font-semibold text-muted-foreground tabular-nums">{index + 1}</span>
              <PlayerAvatar name={p.name} src={p.avatarUrl} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-[var(--color-gold-light)]">{p.name}</span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  <span className="text-emerald-300">{p.wins}W</span> <span className="text-rose-300">{p.losses}L</span> · {p.games} games
                </span>
              </span>
              <WinRateMeter rate={p.winRate} games={p.games} className="shrink-0" />
            </span>
            <span className="flex w-full flex-wrap items-center justify-between gap-2 pl-7">
              <span className="flex items-center gap-2">
                <FormDots form={p.form} />
                <StreakChip streak={p.streak} />
              </span>
              <span className="flex items-center gap-2">
                <MainLane player={p} />
                <TopChampions player={p} />
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  )
}
