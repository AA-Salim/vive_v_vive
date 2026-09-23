"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TitleBadge } from "@/components/title-badge"
import { DebtPledgeDialog } from "@/components/debt-pledge-dialog"
import { toast } from "sonner"
import type { Title } from "@/lib/types"

const CATEGORIES = [
  { key: "rebellion", label: "Rebellion" },
  { key: "mockery", label: "Mockery" },
  { key: "loyalty", label: "Loyalty" },
  { key: "absurd", label: "Absurd" },
] as const

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-gold)]">
          Title Shop
        </h1>
        <p className="mt-1 text-sm text-[var(--color-gold-light)]/50">
          Buy titles for yourself or bestow mockery upon others.
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

      <div className="flex gap-2">
        {CATEGORIES.map((cat) => (
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
