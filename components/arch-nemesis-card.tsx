"use client"

import { Card, CardContent } from "@/components/ui/card"

interface ArchNemesisCardProps {
  playerAName: string
  playerBName: string
  laneDuels: number
  aLaneWins: number
  bLaneWins: number
}

export function ArchNemesisCard({
  playerAName,
  playerBName,
  laneDuels,
  aLaneWins,
  bLaneWins,
}: ArchNemesisCardProps) {
  return (
    <Card className="border-[var(--color-gold)]/20 bg-[var(--color-navy-light)]">
      <CardContent className="flex flex-col items-center gap-4 py-6">
        <h2 className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--color-gold)]/60">
          Arch-Nemesis
        </h2>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-2xl font-bold text-[var(--color-blue-team)]">
              {playerAName}
            </p>
            <p className="text-3xl font-black tabular-nums text-[var(--color-blue-team)]">
              {aLaneWins}
            </p>
          </div>

          <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-[var(--color-gold)]">VS</span>
            <span className="text-xs text-[var(--color-gold-light)]/50">
              {laneDuels} lane {laneDuels === 1 ? "duel" : "duels"}
            </span>
          </div>

          <div className="text-left">
            <p className="text-2xl font-bold text-[var(--color-red-team)]">
              {playerBName}
            </p>
            <p className="text-3xl font-black tabular-nums text-[var(--color-red-team)]">
              {bLaneWins}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
