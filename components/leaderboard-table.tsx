"use client"

import Image from "next/image"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  avatar_url: string | null
  player_name: string | null
  balance: number
  last_change: number | null
  total_kisses: number
  is_current_user: boolean
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[]
}

export function LeaderboardTable({ entries }: LeaderboardTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="border-[var(--color-gold)]/10">
          <TableHead className="w-12 text-center text-[var(--color-gold-light)]/60">
            #
          </TableHead>
          <TableHead className="text-[var(--color-gold-light)]/60">
            Player
          </TableHead>
          <TableHead className="text-right text-[var(--color-gold-light)]/60">
            Balance
          </TableHead>
          <TableHead className="w-16 text-center text-[var(--color-gold-light)]/60">
            Kisses
          </TableHead>
          <TableHead className="w-20 text-right text-[var(--color-gold-light)]/60">
            Last
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow
            key={entry.user_id}
            className={`border-[var(--color-gold)]/10 ${
              entry.is_current_user
                ? "bg-[var(--color-gold)]/5"
                : ""
            }`}
          >
            <TableCell className="text-center text-sm font-bold text-[var(--color-gold-light)]/70">
              {entry.rank}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[var(--color-navy)]">
                  {entry.avatar_url ? (
                    <Image
                      src={entry.avatar_url}
                      alt={entry.username}
                      width={28}
                      height={28}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-bold text-[var(--color-gold)]">
                      {entry.username.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--color-gold-light)]">
                    {entry.player_name ?? entry.username}
                  </div>
                  {entry.player_name && (
                    <div className="text-xs text-[var(--color-gold-light)]/40">
                      {entry.username}
                    </div>
                  )}
                </div>
                {entry.is_current_user && (
                  <span className="rounded-full bg-[var(--color-gold)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--color-gold)]">
                    YOU
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right text-sm font-bold text-[var(--color-gold)]">
              {entry.balance}
            </TableCell>
            <TableCell className="text-center text-sm text-[var(--color-gold-light)]/50">
              {entry.total_kisses > 0 ? entry.total_kisses : "-"}
            </TableCell>
            <TableCell className="text-right text-sm">
              {entry.last_change !== null && (
                <span
                  className={
                    entry.last_change > 0
                      ? "text-green-400"
                      : entry.last_change < 0
                        ? "text-[var(--color-red-team)]"
                        : "text-[var(--color-gold-light)]/40"
                  }
                >
                  {entry.last_change > 0 ? "+" : ""}
                  {entry.last_change}
                </span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
