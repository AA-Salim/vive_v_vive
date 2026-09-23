"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { CrosshairIcon } from "lucide-react"
import { BountyDialog } from "@/components/bounty-dialog"
import { Button } from "@/components/ui/button"
import type { Bounty } from "@/lib/types"

export function BountyPanel() {
  const { user } = useAuth()
  const [bounties, setBounties] = useState<Bounty[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchBounties = () => {
    fetch("/api/bounties")
      .then((r) => r.json())
      .then((data) => setBounties(data.bounties ?? []))
      .catch(() => {})
  }

  useEffect(() => {
    fetchBounties()
  }, [])

  const hasActiveBounty = bounties.some(
    (b) => b.poster_user_id === user?.id
  )

  return (
    <div className="rounded-lg border border-red-500/20 bg-[var(--color-navy-light)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CrosshairIcon className="h-4 w-4 text-red-400" />
          <span className="text-sm font-bold uppercase tracking-wider text-red-400">
            Bounties
          </span>
        </div>
        {user && !hasActiveBounty && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDialogOpen(true)}
            className="h-7 border-red-500/30 text-xs text-red-400 hover:bg-red-500/10"
          >
            Place Bounty
          </Button>
        )}
      </div>

      {bounties.length === 0 ? (
        <p className="text-xs text-[var(--color-gold-light)]/40">
          No active bounties. The streets are quiet... for now.
        </p>
      ) : (
        <div className="space-y-2">
          {bounties.map((b) => (
            <div
              key={b.id}
              className="rounded border border-red-500/10 bg-[var(--color-navy)]/50 p-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--color-gold-light)]">
                  {b.target_player_name}
                </span>
                <span className="text-sm font-bold text-red-400">
                  {b.amount} pts
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--color-gold-light)]/40">
                <span>by {b.poster_username}</span>
                <span>
                  payout {Math.floor(b.amount * b.payout_multiplier)} pts
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <BountyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onPlaced={fetchBounties}
      />
    </div>
  )
}
