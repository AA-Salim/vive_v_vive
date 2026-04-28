"use client"

import { useEffect, useState } from "react"
import { LeaderboardPodium } from "@/components/leaderboard-podium"
import { LeaderboardTable } from "@/components/leaderboard-table"

interface LeaderboardEntry {
  rank: number
  user_id: string
  username: string
  avatar_url: string | null
  player_name: string | null
  balance: number
  last_change: number | null
  is_current_user: boolean
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/leaderboard")
        if (res.ok) {
          const data = await res.json()
          setEntries(data.leaderboard)
        }
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-gold-light)]/50">Loading...</div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-gold-light)]/50">
          No leaderboard data yet. Points are earned by logging in and playing games.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h1 className="text-center text-2xl font-bold tracking-wider text-[var(--color-gold)]">
        LEADERBOARD
      </h1>

      <LeaderboardPodium entries={entries.slice(0, 3)} />

      <div className="rounded-lg border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)]">
        <LeaderboardTable entries={entries} />
      </div>
    </div>
  )
}
