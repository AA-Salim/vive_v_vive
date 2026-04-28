import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

interface DuoEntry {
  player_a_name: string
  player_b_name: string
  games_together: number
  wins_together: number
  losses_together: number
  win_rate: number
  label: string | null
  bonus_labels: { label: string; text: string }[]
}

interface DuoListProps {
  duos: DuoEntry[]
}

export function DuoList({ duos }: DuoListProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--color-gold)]/10">
      <Table>
        <TableHeader>
          <TableRow className="border-[var(--color-gold)]/10 hover:bg-transparent">
            <TableHead className="w-12 text-center">#</TableHead>
            <TableHead>Duo</TableHead>
            <TableHead className="text-center">Games</TableHead>
            <TableHead className="text-center">Wins</TableHead>
            <TableHead className="text-center">Losses</TableHead>
            <TableHead>Win Rate</TableHead>
            <TableHead>Labels</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {duos.map((duo, i) => (
            <TableRow key={`${duo.player_a_name}-${duo.player_b_name}`} className="border-[var(--color-gold)]/10">
              <TableCell className="text-center text-[var(--color-gold)]/70">
                {i + 1}
              </TableCell>
              <TableCell className="font-medium text-[var(--color-gold-light)]">
                {duo.player_a_name} & {duo.player_b_name}
              </TableCell>
              <TableCell className="text-center">{duo.games_together}</TableCell>
              <TableCell className="text-center text-green-400">
                {duo.wins_together}
              </TableCell>
              <TableCell className="text-center text-red-400">
                {duo.losses_together}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-[var(--color-navy)]">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        duo.win_rate >= 50 ? "bg-green-500" : "bg-red-500"
                      )}
                      style={{ width: `${Math.min(duo.win_rate, 100)}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "text-sm",
                      duo.win_rate >= 50 ? "text-green-400" : "text-red-400"
                    )}
                  >
                    {duo.win_rate}%
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {duo.label && (
                    <span className="rounded-full bg-[var(--color-gold)]/15 px-2 py-0.5 text-xs font-bold text-[var(--color-gold)]">
                      {duo.label}
                    </span>
                  )}
                  {duo.bonus_labels.map((bl) => (
                    <span
                      key={bl.label}
                      className="rounded-full bg-[var(--color-gold)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--color-gold)]/80"
                      title={bl.text}
                    >
                      {bl.label}
                    </span>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
