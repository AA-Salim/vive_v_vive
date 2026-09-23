"use client"

import Image from "next/image"
import type { ActSnapshot } from "@/lib/types"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface ArchiveStandingsProps {
  snapshots: ActSnapshot[]
}

export function ArchiveStandings({ snapshots }: ArchiveStandingsProps) {
  if (!snapshots.length) return null

  return (
    <div className="rounded-lg border border-[var(--color-gold)]/10 bg-[var(--color-navy-light)]">
      <Table>
        <TableHeader>
          <TableRow className="border-b-[var(--color-gold)]/10 hover:bg-transparent">
            <TableHead className="w-12 text-center text-[var(--color-gold-light)]/50">
              #
            </TableHead>
            <TableHead className="text-[var(--color-gold-light)]/50">
              Player
            </TableHead>
            <TableHead className="text-right text-[var(--color-gold-light)]/50">
              Balance
            </TableHead>
            <TableHead className="text-right text-[var(--color-gold-light)]/50">
              Games
            </TableHead>
            <TableHead className="text-right text-[var(--color-gold-light)]/50">
              Win Rate
            </TableHead>
            <TableHead className="text-right text-[var(--color-gold-light)]/50">
              Bets
            </TableHead>
            <TableHead className="text-right text-[var(--color-gold-light)]/50">
              Kisses
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {snapshots.map((s) => (
            <TableRow
              key={s.id}
              className="border-b-[var(--color-gold)]/5 hover:bg-[var(--color-navy-lighter)]"
            >
              <TableCell className="text-center font-bold text-[var(--color-gold-light)]/40">
                {s.rank}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border border-[var(--color-gold)]/20 bg-[var(--color-navy)]">
                    {s.avatar_url ? (
                      <Image
                        src={s.avatar_url}
                        alt=""
                        width={28}
                        height={28}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-[var(--color-gold)]">
                        {(s.player_name ?? s.username ?? "?").charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="font-medium text-[var(--color-gold-light)]">
                    {s.player_name ?? s.username}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-right font-bold text-[var(--color-gold)]">
                {s.final_balance}
              </TableCell>
              <TableCell className="text-right text-[var(--color-gold-light)]/70">
                {s.total_games}
              </TableCell>
              <TableCell className="text-right text-[var(--color-gold-light)]/70">
                {s.win_rate != null ? `${s.win_rate}%` : "-"}
              </TableCell>
              <TableCell className="text-right text-[var(--color-gold-light)]/70">
                {s.total_bets}
              </TableCell>
              <TableCell className="text-right text-[var(--color-gold-light)]/70">
                {s.total_kisses}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
