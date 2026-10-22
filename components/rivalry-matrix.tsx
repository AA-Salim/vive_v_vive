"use client"

import { useMemo } from "react"
import { SwordsIcon } from "lucide-react"
import { PlayerAvatar } from "@/components/pages/avatars"
import type { PlayerRef, Rivalry } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

interface RivalryMatrixProps {
  players: PlayerRef[]
  rivalries: Rivalry[]
  onSelect: (a: string, b: string) => void
  focus?: string | null
}

const key = (x: string, y: string) => (x < y ? `${x}:${y}` : `${y}:${x}`)

export function RivalryMatrix({ players, rivalries, onSelect, focus = null }: RivalryMatrixProps) {
  const byPair = useMemo(() => new Map(rivalries.map((r) => [`${r.a}:${r.b}`, r])), [rivalries])

  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--color-gold)]/15 bg-card">
      <table className="w-full border-separate border-spacing-0 text-xs">
        <caption className="sr-only">Head to head record of each row player against each column player</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-20 bg-card px-3 py-2 text-left text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              Row vs column
            </th>
            {players.map((p) => (
              <th key={p.id} scope="col" className="px-1 py-2" title={p.name}>
                <span className="flex justify-center">
                  <PlayerAvatar name={p.name} src={p.avatarUrl} size="xs" ring={focus === p.id ? "gold" : null} />
                </span>
                <span className="sr-only">{p.name}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((row) => (
            <tr key={row.id} className={cn(focus === row.id && "bg-[var(--color-gold)]/[0.05]")}>
              <th scope="row" className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-medium whitespace-nowrap">
                <span className="flex items-center gap-2">
                  <PlayerAvatar name={row.name} src={row.avatarUrl} size="xs" />
                  <span className={cn("max-w-28 truncate", focus === row.id ? "text-[var(--color-gold)]" : "text-[var(--color-gold-light)]")}>{row.name}</span>
                </span>
              </th>
              {players.map((col) => {
                if (row.id === col.id) {
                  return <td key={col.id} className="bg-[var(--color-navy)]/60" aria-hidden />
                }
                const r = byPair.get(key(row.id, col.id))
                if (!r) {
                  return (
                    <td key={col.id} className="px-1 py-1.5 text-center text-muted-foreground/40">
                      -
                    </td>
                  )
                }
                const isA = r.a === row.id
                const wins = isA ? r.aWins : r.bWins
                const losses = isA ? r.bWins : r.aWins
                return (
                  <td key={col.id} className="p-0.5">
                    <button
                      type="button"
                      onClick={() => onSelect(row.id, col.id)}
                      title={`${row.name} vs ${col.name}: ${wins}-${losses}${r.laneDuels ? `, ${r.laneDuels} lane duels` : ""}`}
                      className={cn(
                        "flex h-9 w-full min-w-12 items-center justify-center gap-0.5 rounded-md font-semibold tabular-nums transition-colors outline-none hover:ring-1 hover:ring-[var(--color-gold)]/40 focus-visible:ring-2 focus-visible:ring-ring/60",
                        wins > losses && "bg-emerald-400/10 text-emerald-300",
                        wins < losses && "bg-rose-400/10 text-rose-300",
                        wins === losses && "bg-[var(--color-gold-light)]/[0.04] text-[var(--color-gold-light)]/70"
                      )}
                    >
                      {wins}-{losses}
                      {r.laneDuels > 0 ? <SwordsIcon className="size-2.5 opacity-70" aria-label="with lane duels" /> : null}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
