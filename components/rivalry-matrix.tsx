"use client"

import { useState, useMemo } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { RivalryDetailDialog } from "@/components/rivalry-detail-dialog"
import { cn } from "@/lib/utils"

interface PlayerInfo {
  id: string
  name: string
}

interface Rivalry {
  player_a: string
  player_b: string
  total_games: number
  a_wins: number
  b_wins: number
  lane_duels: number
  a_lane_wins: number
  b_lane_wins: number
}

interface RivalryMatrixProps {
  players: PlayerInfo[]
  rivalries: Rivalry[]
}

interface CellData {
  wins: number
  losses: number
  hasLaneDuels: boolean
}

export function RivalryMatrix({ players, rivalries }: RivalryMatrixProps) {
  const [selectedPair, setSelectedPair] = useState<{
    aId: string
    bId: string
    aName: string
    bName: string
  } | null>(null)

  const rivalryMap = useMemo(() => {
    const map = new Map<string, Rivalry>()
    for (const r of rivalries) {
      map.set(`${r.player_a}:${r.player_b}`, r)
    }
    return map
  }, [rivalries])

  const getCell = (rowId: string, colId: string): CellData | null => {
    if (rowId === colId) return null

    const [aId, bId] = rowId < colId ? [rowId, colId] : [colId, rowId]
    const rivalry = rivalryMap.get(`${aId}:${bId}`)
    if (!rivalry) return null

    const isRowA = rowId === aId
    return {
      wins: isRowA ? rivalry.a_wins : rivalry.b_wins,
      losses: isRowA ? rivalry.b_wins : rivalry.a_wins,
      hasLaneDuels: rivalry.lane_duels > 0,
    }
  }

  const handleCellClick = (rowPlayer: PlayerInfo, colPlayer: PlayerInfo) => {
    if (rowPlayer.id === colPlayer.id) return

    const [aId, bId] = rowPlayer.id < colPlayer.id
      ? [rowPlayer.id, colPlayer.id]
      : [colPlayer.id, rowPlayer.id]

    if (!rivalryMap.has(`${aId}:${bId}`)) return

    setSelectedPair({
      aId,
      bId,
      aName: rowPlayer.id === aId ? rowPlayer.name : colPlayer.name,
      bName: rowPlayer.id === aId ? colPlayer.name : rowPlayer.name,
    })
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-[var(--color-gold)]/10">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--color-gold)]/10 hover:bg-transparent">
              <TableHead className="sticky left-0 z-10 bg-[var(--color-navy)] text-[var(--color-gold)]/70">
                Player
              </TableHead>
              {players.map((p) => (
                <TableHead
                  key={p.id}
                  className="min-w-[70px] text-center text-xs text-[var(--color-gold)]/70"
                >
                  {p.name}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((rowPlayer) => (
              <TableRow
                key={rowPlayer.id}
                className="border-[var(--color-gold)]/10"
              >
                <TableCell className="sticky left-0 z-10 bg-[var(--color-navy)] font-medium text-[var(--color-gold-light)]">
                  {rowPlayer.name}
                </TableCell>
                {players.map((colPlayer) => {
                  if (rowPlayer.id === colPlayer.id) {
                    return (
                      <TableCell
                        key={colPlayer.id}
                        className="bg-[var(--color-navy-light)]/30 text-center"
                      >
                        <span className="text-xs text-[var(--color-gold-light)]/20">-</span>
                      </TableCell>
                    )
                  }

                  const cell = getCell(rowPlayer.id, colPlayer.id)
                  if (!cell) {
                    return (
                      <TableCell
                        key={colPlayer.id}
                        className="text-center text-xs text-[var(--color-gold-light)]/20"
                      >
                        -
                      </TableCell>
                    )
                  }

                  const isWinning = cell.wins > cell.losses
                  const isLosing = cell.losses > cell.wins

                  return (
                    <TableCell
                      key={colPlayer.id}
                      className={cn(
                        "cursor-pointer text-center text-xs font-medium transition-colors hover:bg-[var(--color-gold)]/5",
                        isWinning && "bg-green-500/10 text-green-400",
                        isLosing && "bg-red-500/10 text-red-400",
                        !isWinning && !isLosing && "text-[var(--color-gold-light)]/60"
                      )}
                      onClick={() => handleCellClick(rowPlayer, colPlayer)}
                    >
                      {cell.wins}-{cell.losses}
                      {cell.hasLaneDuels && (
                        <span className="ml-0.5" title="Lane duels">
                          &#x2694;
                        </span>
                      )}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <RivalryDetailDialog
        open={selectedPair !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedPair(null)
        }}
        playerAId={selectedPair?.aId ?? null}
        playerBId={selectedPair?.bId ?? null}
        playerAName={selectedPair?.aName ?? ""}
        playerBName={selectedPair?.bName ?? ""}
      />
    </>
  )
}
