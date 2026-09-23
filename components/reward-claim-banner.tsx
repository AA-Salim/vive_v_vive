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
  is_consolation?: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  treasury: "Treasury Champion",
  grand_champion: "Grand Champion",
  warrior: "Warrior",
  iron_man: "Iron Man",
  degenerate: "Degenerate",
  devotee: "Devotee",
  punching_bag: "Punching Bag",
  consolation: "Participation Trophy",
}

const CATEGORY_COLORS: Record<string, string> = {
  treasury: "text-yellow-400",
  grand_champion: "text-yellow-400",
  warrior: "text-red-400",
  iron_man: "text-blue-400",
  degenerate: "text-green-400",
  devotee: "text-pink-400",
  punching_bag: "text-orange-400",
  consolation: "text-purple-400",
}

const ROAST_MESSAGES = [
  "No real rewards for you. Act I saw what you did and chose violence.",
  "You went through all of Act I and won... absolutely nothing. Impressive, honestly.",
  "The Charamil voted. You got zero awards. Democracy is brutal.",
  "Salaxe himself checked the stats and said 'even I would not give this one anything.'",
  "Act I rewards have been distributed. You were not on the list. Or any list. Ever.",
  "Everyone else is claiming titles and bonus points. You are claiming emotional damage.",
  "No bonus. No glory. No sympathy. But hey, at least you showed up.",
  "The crown fell and somehow still didn't land anywhere near you.",
]

export function RewardClaimBanner() {
  const { user } = useAuth()
  const { refetch: refetchPoints } = usePoints(user?.id ?? null)
  const [awards, setAwards] = useState<UnclaimedAward[]>([])
  const [loaded, setLoaded] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [roast] = useState(() =>
    ROAST_MESSAGES[Math.floor(Math.random() * ROAST_MESSAGES.length)]
  )

  useEffect(() => {
    if (!user) return
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
        toast.success(`Claimed "${data.title}"!`)
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

  if (!user || !loaded) return null
  if (awards.length === 0) return null

  const isConsolation = awards.every((a) => a.is_consolation)
  const hasRealAwards = awards.some((a) => !a.is_consolation)

  if (isConsolation) {
    return (
      <>
        <button
          onClick={() => setDialogOpen(true)}
          className="w-full rounded-lg border border-purple-500/30 bg-gradient-to-r from-purple-500/5 via-red-500/5 to-purple-500/5 p-4 text-center transition-all hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)]"
        >
          <div className="flex items-center justify-center gap-2">
            <SkullIcon className="h-4 w-4 text-purple-400/70" />
            <span className="text-sm font-bold tracking-wider text-purple-400">
              ACT {awards[0]?.acts?.act_number ?? "I"} LEFT YOU SOMETHING
            </span>
            <SkullIcon className="h-4 w-4 text-purple-400/70" />
          </div>
          <div className="mt-1 text-xs text-[var(--color-gold-light)]/40">
            It's not much, but it's yours
          </div>
        </button>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg border-purple-500/30 bg-[var(--color-navy)]">
            <DialogHeader>
              <DialogTitle className="text-center text-purple-400">
                Your Participation Trophy
              </DialogTitle>
            </DialogHeader>

            <p className="text-center text-xs text-red-400/60">
              {roast}
            </p>

            <div className="mt-1 text-center text-[10px] text-[var(--color-gold-light)]/30">
              But since you bothered showing up...
            </div>

            <div className="space-y-3 py-2">
              {awards.map((award) => (
                <div
                  key={award.id}
                  className="rounded-lg border border-purple-500/20 bg-[var(--color-navy-light)] p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-purple-400">
                        Consolation Title
                      </div>
                      <div className="mt-1 text-sm font-semibold text-[var(--color-gold-light)]">
                        &ldquo;{award.title}&rdquo;
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleClaim(award.id)}
                      disabled={claiming === award.id}
                      className="bg-purple-500 text-xs font-bold text-white hover:bg-purple-600"
                    >
                      {claiming === award.id ? "Claiming..." : "Claim"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </>
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
                className={`rounded-lg border p-4 ${
                  award.is_consolation
                    ? "border-purple-500/20 bg-[var(--color-navy-light)]"
                    : "border-[var(--color-gold)]/20 bg-[var(--color-navy-light)]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-xs font-bold uppercase tracking-wider ${CATEGORY_COLORS[award.category] ?? "text-[var(--color-gold)]"}`}>
                      {CATEGORY_LABELS[award.category] ?? award.category}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-[var(--color-gold-light)]">
                      {award.is_consolation ? `"${award.title}"` : award.title}
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
                      className={`mt-1 text-xs font-bold ${
                        award.is_consolation
                          ? "bg-purple-500 text-white hover:bg-purple-600"
                          : "bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)]"
                      }`}
                    >
                      {claiming === award.id ? "Claiming..." : "Claim"}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {awards.length > 1 && hasRealAwards && (
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
