"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { DuoShowcaseCard } from "@/components/duo-showcase-card"
import { DuoList } from "@/components/duo-list"

interface DuoData {
  player_a: string
  player_a_name: string
  player_b: string
  player_b_name: string
  games_together: number
  wins_together: number
  losses_together: number
  win_rate: number
  label: string | null
  label_text: string | null
  stronger: string | null
  weaker: string | null
  bonus_labels: { label: string; text: string }[]
}

export default function DuosPage() {
  const [duos, setDuos] = useState<DuoData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/duos")
      .then((r) => r.json())
      .then((data) => {
        if (data.duos) setDuos(data.duos)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (duos.length === 0) {
    return (
      <div className="py-20 text-center text-[var(--color-gold-light)]/40">
        No duo data yet. Play some games together first.
      </div>
    )
  }

  const top3 = duos.filter((d) => d.label !== null).slice(0, 3)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-gold)]">
          Duo Stats
        </h1>
        <p className="mt-1 text-sm text-[var(--color-gold-light)]/50">
          Same-team pair performance rankings
        </p>
      </div>

      {top3.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {top3.map((duo, i) => (
            <DuoShowcaseCard
              key={`${duo.player_a}-${duo.player_b}`}
              playerA={duo.player_a_name}
              playerB={duo.player_b_name}
              label={duo.label!}
              labelText={duo.label_text!}
              wins={duo.wins_together}
              losses={duo.losses_together}
              winRate={duo.win_rate}
              rank={i + 1}
              bonusLabels={duo.bonus_labels}
            />
          ))}
        </div>
      )}

      <DuoList duos={duos} />
    </div>
  )
}
