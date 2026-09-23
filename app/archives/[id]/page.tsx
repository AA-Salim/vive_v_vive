"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ArchiveHallOfFame } from "@/components/archive-hall-of-fame"
import { ArchiveStandings } from "@/components/archive-standings"
import {
  BalanceTimelineChart,
  BetOutcomesChart,
  SpendingBreakdownChart,
} from "@/components/archive-charts"
import type { Act, ActAward, ActSnapshot } from "@/lib/types"

interface ArchiveData {
  act: Act
  awards: (ActAward & {
    username?: string
    avatar_url?: string | null
    player_name?: string | null
  })[]
  snapshots: ActSnapshot[]
  charts: {
    balanceTimeline: Record<string, string | number>[]
    betOutcomes: { name: string; won: number; lost: number; refunded: number }[]
    spendingBreakdown: { name: string; value: number }[]
  }
}

export default function ArchiveDetailPage() {
  const params = useParams()
  const [data, setData] = useState<ArchiveData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/acts/${params.id}/archive`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [params.id])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-gold-light)]/50">Loading...</div>
      </div>
    )
  }

  if (!data?.act) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-gold-light)]/50">
          Archive not found.
        </div>
      </div>
    )
  }

  // Enrich awards with snapshot data for display
  const snapshotMap = new Map(
    data.snapshots.map((s) => [s.user_id, s])
  )
  const enrichedAwards = data.awards.map((award) => {
    const snapshot = snapshotMap.get(award.user_id)
    return {
      ...award,
      username: snapshot?.username ?? undefined,
      avatar_url: snapshot?.avatar_url ?? undefined,
      player_name: snapshot?.player_name ?? undefined,
    }
  })

  return (
    <div className="space-y-10">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-[var(--color-gold)]">
          {data.act.name}
        </h1>
        <p className="mt-1 text-sm text-[var(--color-gold-light)]/50">
          {new Date(data.act.started_at).toLocaleDateString()} -{" "}
          {data.act.ended_at
            ? new Date(data.act.ended_at).toLocaleDateString()
            : "Ongoing"}
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-xl font-bold text-[var(--color-gold-light)]">
          Hall of Fame
        </h2>
        <ArchiveHallOfFame awards={enrichedAwards} />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-[var(--color-gold-light)]">
          Final Standings
        </h2>
        <ArchiveStandings snapshots={data.snapshots} />
      </section>

      <section className="space-y-6">
        <h2 className="text-xl font-bold text-[var(--color-gold-light)]">
          Act Data
        </h2>
        <BalanceTimelineChart data={data.charts.balanceTimeline} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <BetOutcomesChart data={data.charts.betOutcomes} />
          <SpendingBreakdownChart data={data.charts.spendingBreakdown} />
        </div>
      </section>
    </div>
  )
}
