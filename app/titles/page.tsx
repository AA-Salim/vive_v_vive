"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TitleBadge } from "@/components/title-badge"
import { DebtPledgeDialog } from "@/components/debt-pledge-dialog"
import { toast } from "sonner"
import { MILESTONE_GROUPS } from "@/lib/milestones"
import type { Title } from "@/lib/types"

const SHOP_CATEGORIES = [
  { key: "rebellion", label: "Rebellion" },
  { key: "mockery", label: "Mockery" },
  { key: "loyalty", label: "Loyalty" },
  { key: "absurd", label: "Absurd" },
] as const

type PageTab = "shop" | "milestones"

interface MilestoneItem {
  id: string
  title: string
  description: string
  group: string
  threshold: number
  stat: string
  current: number
  unlocked: boolean
  claimed: boolean
}

export default function TitlesPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { balance, refetch: refresh } = usePoints(user?.id ?? null)
  const [titles, setTitles] = useState<Title[]>([])
  const [owned, setOwned] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string>("rebellion")
  const [isLoading, setIsLoading] = useState(true)
  const [buying, setBuying] = useState<string | null>(null)
  const [debtPledgeOpen, setDebtPledgeOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [profiles, setProfiles] = useState<
    { id: string; discord_username: string }[]
  >([])
  const [tab, setTab] = useState<PageTab>("shop")
  const [milestones, setMilestones] = useState<MilestoneItem[]>([])
  const [milestonesLoading, setMilestonesLoading] = useState(false)
  const [claiming, setClaiming] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/titles").then((r) => r.json()),
      fetch("/api/auth/profiles").then((r) => r.json()),
    ])
      .then(([titlesData, profilesData]) => {
        setTitles(titlesData.titles ?? [])
        setOwned(titlesData.owned ?? [])
        setActiveId(titlesData.active_title_id ?? null)
        setProfiles(profilesData.profiles ?? [])
      })
      .finally(() => setIsLoading(false))
  }, [])

  const loadMilestones = () => {
    setMilestonesLoading(true)
    fetch("/api/titles/milestones")
      .then((r) => r.json())
      .then((data) => setMilestones(data.milestones ?? []))
      .finally(() => setMilestonesLoading(false))
  }

  useEffect(() => {
    if (tab === "milestones" && milestones.length === 0) {
      loadMilestones()
    }
  }, [tab])

  const handleBuy = async (title: Title, targetUserId?: string) => {
    if (!user) return

    if (balance < 0) {
      setPendingAction(() => () => executeBuy(title, targetUserId))
      setDebtPledgeOpen(true)
      return
    }

    await executeBuy(title, targetUserId)
  }

  const executeBuy = async (title: Title, targetUserId?: string) => {
    setBuying(title.id)
    try {
      const res = await fetch("/api/titles/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title_id: title.id,
          target_user_id: targetUserId,
        }),
      })
      const data = await res.json()
      if (data.purchased) {
        toast.success(`Acquired: ${title.name}`)
        setOwned((prev) => [...prev, title.id])
        refresh()
      } else {
        toast.error(data.error ?? "Failed to buy title")
      }
    } catch {
      toast.error("Failed to buy title")
    } finally {
      setBuying(null)
    }
  }

  const handleActivate = async (titleId: string | null) => {
    const res = await fetch("/api/titles/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title_id: titleId }),
    })
    const data = await res.json()
    if (data.activated) {
      setActiveId(titleId)
      toast.success(titleId ? "Title activated" : "Title removed")
    }
  }

  const handleClaimMilestone = async (milestoneId: string) => {
    setClaiming(milestoneId)
    try {
      const res = await fetch("/api/titles/milestones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ milestone_id: milestoneId }),
      })
      const data = await res.json()
      if (data.claimed) {
        toast.success(`Claimed: ${data.title}`)
        setMilestones((prev) =>
          prev.map((m) => (m.id === milestoneId ? { ...m, claimed: true } : m))
        )
        const titlesRes = await fetch("/api/titles").then((r) => r.json())
        setTitles(titlesRes.titles ?? [])
        setOwned(titlesRes.owned ?? [])
      } else {
        toast.error(data.error ?? "Failed to claim")
      }
    } catch {
      toast.error("Failed to claim milestone")
    } finally {
      setClaiming(null)
    }
  }

  const handleClaimAll = async () => {
    const claimable = milestones.filter((m) => m.unlocked && !m.claimed)
    for (const m of claimable) {
      await handleClaimMilestone(m.id)
    }
  }

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-gold-light)]/50">Loading...</div>
      </div>
    )
  }

  const shopTitles = titles.filter(
    (t) => t.category !== "award" && t.category === activeCategory
  )
  const myTitles = titles.filter((t) => owned.includes(t.id))
  const claimableCount = milestones.filter((m) => m.unlocked && !m.claimed).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-gold)]">Titles</h1>
        <p className="mt-1 text-sm text-[var(--color-gold-light)]/50">
          Buy titles, earn milestones, equip your favorite.
        </p>
      </div>

      {myTitles.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-gold-light)]/50">
            Your Titles
          </h2>
          <div className="flex flex-wrap gap-2">
            {myTitles.map((t) => (
              <button
                key={t.id}
                onClick={() =>
                  handleActivate(activeId === t.id ? null : t.id)
                }
                className={`rounded-lg border p-3 text-left transition-colors ${
                  activeId === t.id
                    ? "border-[var(--color-gold)] bg-[var(--color-gold)]/10"
                    : "border-[var(--color-gold)]/10 bg-[var(--color-navy-light)] hover:border-[var(--color-gold)]/30"
                }`}
              >
                <TitleBadge name={t.name} category={t.category} />
                <div className="mt-1 text-xs text-[var(--color-gold-light)]/40">
                  {activeId === t.id ? "Active" : "Click to equip"}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 border-b border-[var(--color-gold)]/10 pb-1">
        <button
          onClick={() => setTab("shop")}
          className={`rounded-t-md px-4 py-2 text-sm font-bold transition-colors ${
            tab === "shop"
              ? "bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
              : "text-[var(--color-gold-light)]/40 hover:text-[var(--color-gold-light)]/70"
          }`}
        >
          Shop
        </button>
        <button
          onClick={() => setTab("milestones")}
          className={`relative rounded-t-md px-4 py-2 text-sm font-bold transition-colors ${
            tab === "milestones"
              ? "bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
              : "text-[var(--color-gold-light)]/40 hover:text-[var(--color-gold-light)]/70"
          }`}
        >
          Milestones
          {claimableCount > 0 && (
            <span className="ml-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-green-500 px-1.5 text-[10px] font-bold text-white">
              {claimableCount}
            </span>
          )}
        </button>
      </div>

      {tab === "shop" && (
        <>
          <div className="flex gap-2">
            {SHOP_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeCategory === cat.key
                    ? "bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
                    : "text-[var(--color-gold-light)]/50 hover:text-[var(--color-gold-light)]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shopTitles.map((title) => {
              const isOwned = owned.includes(title.id)
              const isMockery = !title.for_self

              return (
                <div
                  key={title.id}
                  className="rounded-lg border border-[var(--color-gold)]/10 bg-[var(--color-navy-light)] p-4"
                >
                  <div className="mb-2 flex items-start justify-between">
                    <TitleBadge name={title.name} category={title.category} />
                    <Badge
                      variant="outline"
                      className="border-[var(--color-gold)]/20 text-[var(--color-gold)]"
                    >
                      {title.price} pts
                    </Badge>
                  </div>
                  <p className="mb-3 text-xs text-[var(--color-gold-light)]/50">
                    {title.description}
                  </p>
                  {isMockery && (
                    <p className="mb-2 text-[10px] font-semibold uppercase text-purple-400/70">
                      Assigned to another player
                    </p>
                  )}
                  {isOwned ? (
                    <div className="text-xs font-semibold text-[var(--color-gold-light)]/40">
                      Owned
                    </div>
                  ) : isMockery ? (
                    <select
                      className="w-full rounded border border-[var(--color-gold)]/20 bg-[var(--color-navy)] px-2 py-1.5 text-xs text-[var(--color-gold-light)]"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handleBuy(title, e.target.value)
                      }}
                      disabled={buying === title.id}
                    >
                      <option value="" disabled>
                        Pick a victim...
                      </option>
                      {profiles
                        .filter((p) => p.id !== user?.id)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.discord_username}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleBuy(title)}
                      disabled={buying === title.id}
                      className="bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)]"
                    >
                      {buying === title.id ? "Buying..." : "Buy"}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === "milestones" && (
        <div className="space-y-6">
          {milestonesLoading ? (
            <div className="py-10 text-center text-sm text-[var(--color-gold-light)]/50">
              Loading milestones...
            </div>
          ) : (
            <>
              {claimableCount > 1 && (
                <Button
                  onClick={handleClaimAll}
                  disabled={claiming !== null}
                  className="bg-green-600 font-bold text-white hover:bg-green-700"
                >
                  Claim All ({claimableCount})
                </Button>
              )}

              {MILESTONE_GROUPS.map((group) => {
                const groupMilestones = milestones.filter(
                  (m) => m.group === group.key
                )
                if (groupMilestones.length === 0) return null

                return (
                  <div key={group.key}>
                    <h3 className={`mb-3 text-xs font-bold uppercase tracking-wider ${group.color}`}>
                      {group.label}
                    </h3>
                    <div className="space-y-2">
                      {groupMilestones.map((m) => {
                        const progress = Math.min(
                          (m.current / m.threshold) * 100,
                          100
                        )
                        return (
                          <div
                            key={m.id}
                            className={`rounded-lg border p-3 ${
                              m.claimed
                                ? "border-green-500/20 bg-green-500/5"
                                : m.unlocked
                                  ? "border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5"
                                  : "border-[var(--color-gold)]/5 bg-[var(--color-navy-light)]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`text-sm font-semibold ${
                                      m.claimed
                                        ? "text-green-400"
                                        : m.unlocked
                                          ? "text-[var(--color-gold)]"
                                          : "text-[var(--color-gold-light)]/40"
                                    }`}
                                  >
                                    {m.title}
                                  </span>
                                  {m.claimed && (
                                    <span className="text-[10px] font-bold text-green-400/60">
                                      CLAIMED
                                    </span>
                                  )}
                                </div>
                                <div className="mt-0.5 text-xs text-[var(--color-gold-light)]/40">
                                  {m.description}
                                </div>
                                {!m.claimed && (
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-navy)]">
                                      <div
                                        className={`h-full rounded-full transition-all ${
                                          m.unlocked
                                            ? "bg-[var(--color-gold)]"
                                            : "bg-[var(--color-gold)]/30"
                                        }`}
                                        style={{ width: `${progress}%` }}
                                      />
                                    </div>
                                    <span className="shrink-0 text-[10px] tabular-nums text-[var(--color-gold-light)]/40">
                                      {m.stat === "win_rate"
                                        ? `${m.current.toFixed(1)}%`
                                        : Math.floor(m.current)}
                                      {" / "}
                                      {m.stat === "win_rate"
                                        ? `${m.threshold}%`
                                        : m.threshold}
                                    </span>
                                  </div>
                                )}
                              </div>
                              {m.unlocked && !m.claimed && (
                                <Button
                                  size="sm"
                                  onClick={() => handleClaimMilestone(m.id)}
                                  disabled={claiming === m.id}
                                  className="shrink-0 bg-[var(--color-gold)] text-xs font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)]"
                                >
                                  {claiming === m.id ? "..." : "Claim"}
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}

      <DebtPledgeDialog
        open={debtPledgeOpen}
        onOpenChange={setDebtPledgeOpen}
        currentBalance={balance}
        onConfirm={() => {
          pendingAction?.()
          setPendingAction(null)
        }}
      />
    </div>
  )
}
