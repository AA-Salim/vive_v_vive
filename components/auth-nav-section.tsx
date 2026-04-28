"use client"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import { AuthButton } from "@/components/auth-button"
import { PointBadge } from "@/components/point-badge"
import { SalaxeDailyDialog } from "@/components/salaxe-daily-dialog"

export function AuthNavSection() {
  const { user, profile } = useAuth()
  const { balance, lastDailyClaim, isLoading, initialize, claimDaily } =
    usePoints(user?.id ?? null)
  const [showSalaxe, setShowSalaxe] = useState(false)
  const initRef = useRef(false)

  useEffect(() => {
    if (!user || isLoading || initRef.current) return
    initRef.current = true

    const run = async () => {
      await initialize()

      const today = new Date().toISOString().split("T")[0]
      if (lastDailyClaim !== today) {
        const result = await claimDaily()
        if (result?.claimed) {
          setShowSalaxe(true)
        }
      }
    }

    run()
  }, [user, isLoading, lastDailyClaim, initialize, claimDaily])

  return (
    <div className="flex items-center gap-2">
      {user && !isLoading && <PointBadge balance={balance} />}
      <AuthButton />
      {showSalaxe && (
        <SalaxeDailyDialog
          open={showSalaxe}
          onDismiss={() => setShowSalaxe(false)}
          username={profile?.discord_username ?? "Summoner"}
        />
      )}
    </div>
  )
}
