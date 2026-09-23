"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { TrophyIcon, SkullIcon } from "lucide-react"

interface UnclaimedAward {
  id: string
  category: string
  title: string
  carry_over_bonus: number
  final_value: string | null
  perks: Record<string, unknown>
  acts: { act_number: number; name: string } | null
}

const CATEGORY_LABELS: Record<string, string> = {
  treasury: "Treasury Champion",
  grand_champion: "Grand Champion",
  warrior: "Warrior",
  iron_man: "Iron Man",
  degenerate: "Degenerate",
  devotee: "Devotee",
  punching_bag: "Punching Bag",
}

const CATEGORY_COLORS: Record<string, string> = {
  treasury: "text-yellow-400",
  grand_champion: "text-yellow-400",
  warrior: "text-red-400",
  iron_man: "text-blue-400",
  degenerate: "text-green-400",
  devotee: "text-pink-400",
  punching_bag: "text-orange-400",
}

const ROAST_MESSAGES = [
  "No rewards for you. Act I saw what you did and chose violence.",
  "You went through all of Act I and won... absolutely nothing. Impressive, honestly.",
  "The Charamil voted. You got zero awards. Democracy is brutal.",
  "Salaxe himself checked the stats and said 'even I would not give this one anything.'",
  "Act I rewards have been distributed. You were not on the list. Or any list. Ever.",
  "Everyone else is claiming titles and bonus points. You are claiming emotional damage.",
  "No title. No bonus. No sympathy. Better luck in Act II.",
  "The crown fell and somehow still didn't land anywhere near you.",
]

export function RewardClaimBanner() {
  const { user } = useAuth()
  const { refetch: refetchPoints } = usePoints(user?.id ?? null)
  const [awards, setAwards] = useState<UnclaimedAward[]>([])
  const [loaded, setLoaded] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [roast] = useState(() =>
    ROAST_MESSAGES[Math.floor(Math.random() * ROAST_MESSAGES.length)]
  )

  useEffect(() => {
    if (!user) return
    if (localStorage.getItem("act1-no-rewards-seen")) {
      setDismissed(true)
    }
    fetch("/api/acts/claim-rewards")
      .then((r) => r.json())
      .then((data) => {
        setAwards(data.awards ?? [])
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [user])

  const handleClaim = async (awardId: string) => {
    setClaiming(awardId)
    try {
      const res = await fetch("/api/acts/claim-rewards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ award_id: awardId }),
      })
      const data = await res.json()
      if (data.claimed) {
        toast.success(
          data.bonus > 0
            ? `Claimed "${data.title}" and +${data.bonus} bonus points!`
            : `Claimed "${data.title}"!`
        )
        setAwards((prev) => prev.filter((a) => a.id !== awardId))
        await refetchPoints()
      } else {
        toast.error(data.error ?? "Failed to claim")
      }
    } catch {
      toast.error("Failed to claim reward")
    } finally {
      setClaiming(null)
    }
  }

  const handleClaimAll = async () => {
    for (const award of awards) {
      await handleClaim(award.id)
    }
    setDialogOpen(false)
  }

  const handleDismissRoast = () => {
    localStorage.setItem("act1-no-rewards-seen", "true")
    setDismissed(true)
  }

  if (!user || !loaded) return null

  if (awards.length === 0) {
    if (dismissed) return null

    return (
      <div className="relative rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center">
        <button
          onClick={handleDismissRoast}
          className="absolute right-3 top-3 text-xs text-[var(--color-gold-light)]/30 hover:text-[var(--color-gold-light)]/60"
        >
          dismiss
        </button>
        <div className="flex items-center justify-center gap-2">
          <SkullIcon className="h-4 w-4 text-red-400/60" />
          <span className="text-xs font-bold uppercase tracking-wider text-red-400/60">
            ACT I REWARDS
          </span>
          <SkullIcon className="h-4 w-4 text-red-400/60" />
        </div>
        <p className="mt-2 text-sm text-[var(--color-gold-light)]/60">
          {roast}
        </p>
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="w-full animate-pulse rounded-lg border border-[var(--color-gold)]/40 bg-gradient-to-r from-[var(--color-gold)]/10 via-yellow-500/10 to-[var(--color-gold)]/10 p-4 text-center transition-all hover:border-[var(--color-gold)]/60 hover:shadow-[0_0_20px_rgba(200,155,60,0.15)]"
      >
        <div className="flex items-center justify-center gap-3">
          <TrophyIcon className="h-5 w-5 text-[var(--color-gold)]" />
          <span className="text-sm font-bold tracking-wider text-[var(--color-gold)]">
            YOU HAVE UNCLAIMED REWARDS FROM ACT {awards[0]?.acts?.act_number ?? "I"}
          </span>
          <TrophyIcon className="h-5 w-5 text-[var(--color-gold)]" />
        </div>
        <div className="mt-1 text-xs text-[var(--color-gold-light)]/60">
          Click to claim your titles and bonus points
        </div>
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg border-[var(--color-gold)]/30 bg-[var(--color-navy)]">
          <DialogHeader>
            <DialogTitle className="text-center text-[var(--color-gold)]">
              Claim Your Rewards
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {awards.map((award) => (
              <div
                key={award.id}
                className="rounded-lg border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)] p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-xs font-bold uppercase tracking-wider ${CATEGORY_COLORS[award.category] ?? "text-[var(--color-gold)]"}`}>
                      {CATEGORY_LABELS[award.category] ?? award.category}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[var(--color-gold-light)]">
                      {award.title}
                    </div>
                    {award.final_value && (
                      <div className="mt-0.5 text-xs text-[var(--color-gold-light)]/50">
                        {award.final_value}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    {award.carry_over_bonus > 0 && (
                      <div className="text-lg font-bold text-green-400">
                        +{award.carry_over_bonus}
                      </div>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleClaim(award.id)}
                      disabled={claiming === award.id}
                      className="mt-1 bg-[var(--color-gold)] text-xs font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)]"
                    >
                      {claiming === award.id ? "Claiming..." : "Claim"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {awards.length > 1 && (
            <Button
              onClick={handleClaimAll}
              disabled={claiming !== null}
              className="w-full bg-[var(--color-gold)] font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)]"
            >
              Claim All
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
