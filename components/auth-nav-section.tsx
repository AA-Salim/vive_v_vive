"use client"

import { useEffect, useRef, useState } from "react"
import { AuthButton } from "@/components/auth-button"
import { LiveIndicator } from "@/components/live/live-indicator"
import { PointBadge } from "@/components/point-badge"
import { SalaxeDailyDialog } from "@/components/salaxe-daily-dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { usePoints, type DailyClaim } from "@/hooks/use-points"

// Mounted once in the header: it also runs the first-visit initialisation and the daily grant.
export function AuthNavSection() {
  const { user, profile } = useAuth()
  const { balance, lastDailyClaim, isLoading, initialize, claimDaily } = usePoints(user?.id ?? null)
  const [claim, setClaim] = useState<DailyClaim | null>(null)
  const showSalaxe = claim !== null
  const initRef = useRef(false)

  useEffect(() => {
    if (!user || isLoading || initRef.current) return
    initRef.current = true

    const run = async () => {
      await initialize()
      const today = new Date().toISOString().split("T")[0]
      if (lastDailyClaim !== today) {
        const result = await claimDaily()
        if (result?.claimed) setClaim(result)
      }
    }

    void run()
  }, [user, isLoading, lastDailyClaim, initialize, claimDaily])

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <LiveIndicator compact />
      {user && (isLoading ? <Skeleton className="h-10 w-20 rounded-full" /> : <PointBadge balance={balance} />)}
      <AuthButton />
      {showSalaxe && (
        <SalaxeDailyDialog
          open={showSalaxe}
          claim={claim}
          onDismiss={() => setClaim(null)}
          username={profile?.discord_username ?? "Summoner"}
        />
      )}
    </div>
  )
}
