"use client"

import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CoinsIcon } from "lucide-react"
import type { PointReason } from "@/lib/types"

const REASON_LABELS: Record<PointReason, string> = {
  initial_grant: "Welcome Bonus",
  daily_bonus: "Daily Bonus",
  game_win: "Game Win",
  game_participation: "Game Played",
  bet_placed: "Bet Placed",
  bet_won: "Bet Won",
  bet_refunded: "Bet Refunded",
  kiss_the_hand: "Kiss the Hand",
}

export default function ProfilePage() {
  const { user, profile, isLoading: authLoading } = useAuth()
  const { balance, transactions, isLoading: pointsLoading } = usePoints(
    user?.id ?? null
  )

  if (authLoading || pointsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-gold-light)]/50">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-gold-light)]/50">
          Log in with Discord to view your profile.
        </div>
      </div>
    )
  }

  const earned = transactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)
  const spent = transactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-[var(--color-gold)]">
          {profile?.discord_username ?? "Profile"}
        </h1>
        {profile?.player_id && (
          <Badge className="bg-[var(--color-gold)]/20 text-[var(--color-gold)]">
            Player Linked
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-[var(--color-gold)]/20 bg-[var(--color-navy-light)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-[var(--color-gold-light)]/60">
              <CoinsIcon className="h-4 w-4" />
              Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--color-gold)]">
              {balance}
            </div>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-gold)]/20 bg-[var(--color-navy-light)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-gold-light)]/60">
              Total Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-400">+{earned}</div>
          </CardContent>
        </Card>

        <Card className="border-[var(--color-gold)]/20 bg-[var(--color-navy-light)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-[var(--color-gold-light)]/60">
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-[var(--color-red-team)]">
              -{spent}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-[var(--color-gold)]/20 bg-[var(--color-navy-light)]">
        <CardHeader>
          <CardTitle className="text-[var(--color-gold)]">
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="py-4 text-center text-sm text-[var(--color-gold-light)]/50">
              No transactions yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-[var(--color-gold)]/10">
                  <TableHead className="text-[var(--color-gold-light)]/60">
                    Date
                  </TableHead>
                  <TableHead className="text-[var(--color-gold-light)]/60">
                    Reason
                  </TableHead>
                  <TableHead className="text-right text-[var(--color-gold-light)]/60">
                    Amount
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow
                    key={tx.id}
                    className="border-[var(--color-gold)]/10"
                  >
                    <TableCell className="text-sm text-[var(--color-gold-light)]/70">
                      {new Date(tx.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-sm text-[var(--color-gold-light)]">
                      {REASON_LABELS[tx.reason] ?? tx.reason}
                    </TableCell>
                    <TableCell
                      className={`text-right text-sm font-medium ${
                        tx.amount > 0 ? "text-green-400" : "text-[var(--color-red-team)]"
                      }`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      {tx.amount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
