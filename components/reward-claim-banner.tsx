"use client"

import { useMemo, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronRightIcon, SkullIcon, TrophyIcon } from "lucide-react"
import { toast } from "sonner"
import { fireWinConfetti } from "@/components/betting/confetti"
import { useLiveSignal } from "@/components/live/live-context"
import { RewardCard, groupAwards, type AwardGroup, type UnclaimedAward } from "@/components/lore/reward-card"
import { useVisibleViewport } from "@/components/lore/use-visible-viewport"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useAuth } from "@/hooks/use-auth"
import { pointsKey } from "@/hooks/use-points"
import { useSession } from "@/hooks/use-session"
import { TIMED_STATUSES } from "@/lib/live/events"
import { roman } from "@/lib/lore/herald/kit"
import { ceremonyLine, consolationAside, consolationRoast, rewardCopy } from "@/lib/lore/rewards"
import { cn } from "@/lib/utils"

export function claimRewardsKey(userId: string | null | undefined) {
  return ["acts", "claim-rewards", userId ?? "anonymous"] as const
}

async function fetchAwards(signal: AbortSignal): Promise<UnclaimedAward[]> {
  const res = await fetch("/api/acts/claim-rewards", { signal, cache: "no-store" })
  if (!res.ok) throw new Error(`GET /api/acts/claim-rewards failed with ${res.status}`)
  const data = (await res.json()) as { awards?: unknown }
  return Array.isArray(data.awards) ? (data.awards as UnclaimedAward[]) : []
}

// Points paid by this request: 0 when another tab or device already claimed it (409).
async function claimOne(awardId: string): Promise<number> {
  const res = await fetch("/api/acts/claim-rewards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ award_id: awardId }),
  })
  if (res.status === 409) return 0
  const data = (await res.json().catch(() => null)) as { bonus?: unknown; error?: string } | null
  if (res.ok) return typeof data?.bonus === "number" ? data.bonus : 0
  throw new Error(data?.error ?? "The archivist dropped the scroll. Try again.")
}

export function RewardClaimBanner() {
  const { user } = useAuth()
  const { session } = useSession()
  const queryClient = useQueryClient()
  const reduceMotion = useReducedMotion() ?? false
  const pinned = useVisibleViewport(512)
  const userId = user?.id ?? null
  const key = claimRewardsKey(userId)
  const [open, setOpen] = useState(false)
  const [engraved, setEngraved] = useState<AwardGroup[]>([])

  const { data: awards = [] } = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchAwards(signal),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })
  const groups = useMemo(() => groupAwards(awards), [awards])

  const claim = useMutation({
    mutationFn: async (group: AwardGroup) => {
      let paid = 0
      for (const id of group.ids) paid += await claimOne(id)
      return { group, paid }
    },
    onSuccess: ({ group, paid }) => {
      setEngraved((prev) => [...prev.filter((g) => g.key !== group.key), group])
      queryClient.setQueryData<UnclaimedAward[]>(key, (old) => (old ?? []).filter((a) => !group.ids.includes(a.id)))
      void queryClient.invalidateQueries({ queryKey: pointsKey(userId) })
      void queryClient.invalidateQueries({ queryKey: ["titles"] })
      const copy = rewardCopy(group.categories[0] ?? "consolation")
      if (group.consolation) {
        toast(`Engraved: "${group.title}"`, { description: copy.engraved })
      } else {
        fireWinConfetti(null)
        toast.success(`Engraved: ${group.title}`, {
          description: paid > 0 ? `+${paid} to your purse. ${copy.engraved}` : copy.engraved,
        })
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "The archivist dropped the scroll."),
  })

  // Claimed from another tab or device: drop it here too. Our own claims already updated the cache.
  useLiveSignal((signal) => {
    if (signal.kind !== "event" || signal.event.type !== "title.claimed") return
    if (userId && signal.event.actor?.userId === userId && !claim.isPending) {
      void queryClient.invalidateQueries({ queryKey: claimRewardsKey(userId) })
    }
  })

  const claimAll = async () => {
    for (const group of groups) {
      try {
        await claim.mutateAsync(group)
      } catch {
        return
      }
    }
  }

  const close = (next: boolean) => {
    setOpen(next)
    if (!next) setEngraved([])
  }

  const busy = !!session && TIMED_STATUSES.includes(session.status)
  if (!userId || (groups.length === 0 && !open) || (busy && !open)) return null

  const shown = [...groups, ...engraved.filter((e) => !groups.some((g) => g.key === e.key))]
  const consolationOnly = shown.length > 0 && shown.every((g) => g.consolation)
  const actNumber = shown[0]?.actNumber ?? 1
  const actName = awards[0]?.acts?.name ?? null
  const seed = `${userId}:${actNumber}`
  const totalBonus = groups.reduce((sum, g) => sum + g.bonus, 0)
  const done = groups.length === 0 && engraved.length > 0

  return (
    <>
      {groups.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "group relative w-full overflow-hidden rounded-2xl border bg-card px-4 py-3.5 text-left shadow-lg shadow-black/30 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
            consolationOnly ? "border-border hover:border-[var(--color-gold)]/30" : "border-[var(--color-gold)]/40 hover:border-[var(--color-gold)]/70"
          )}
        >
          {!consolationOnly && !reduceMotion && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-linear-to-r from-transparent via-[var(--color-gold)]/12 to-transparent"
              initial={{ x: "0%" }}
              animate={{ x: "420%" }}
              transition={{ duration: 2.2, ease: "easeInOut", repeat: Infinity, repeatDelay: 5 }}
            />
          )}
          <span className="relative flex items-center gap-3">
            <span
              className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl ring-1",
                consolationOnly ? "bg-muted ring-border" : "bg-[var(--color-gold)]/12 ring-[var(--color-gold)]/35"
              )}
            >
              {consolationOnly ? (
                <SkullIcon className="size-5 text-muted-foreground" aria-hidden />
              ) : (
                <TrophyIcon className="size-5 text-[var(--color-gold)]" aria-hidden />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-semibold tracking-[0.2em] text-[var(--color-gold)]/85 uppercase">
                {consolationOnly ? `Act ${roman(actNumber)} left you something` : `Act ${roman(actNumber)} spoils await`}
              </span>
              <span className="mt-0.5 block font-display text-base leading-snug font-semibold text-foreground">
                {consolationOnly
                  ? "It is not much. It is yours."
                  : `${groups.length === 1 ? "An honor" : `${groups.length} honors`}${totalBonus > 0 ? ` and +${totalBonus} points` : ""} in your name`}
              </span>
            </span>
            <span className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-[var(--color-gold)] sm:inline-flex">
              {consolationOnly ? "Accept your fate" : "Open the vault"}
            </span>
            <ChevronRightIcon className="size-5 shrink-0 text-[var(--color-gold)] transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        </button>
      )}

      <Dialog open={open} onOpenChange={close}>
        <DialogContent
          style={pinned}
          className="flex max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden border border-[var(--color-gold)]/30 bg-[var(--color-navy)] p-0 sm:max-w-lg"
        >
          <div className="relative px-5 pt-6 pb-4 sm:px-6">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)] to-transparent" />
            <p className="pr-10 text-[11px] font-semibold tracking-[0.2em] text-[var(--color-gold)]/80 uppercase">
              {actName ?? `Act ${roman(actNumber)}`}
            </p>
            <DialogTitle className="mt-1 pr-10 font-display text-2xl leading-tight font-semibold text-[var(--color-gold-light)]">
              {done ? "The vault is empty" : consolationOnly ? "Your participation trophy" : "Claim your spoils"}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
              {done
                ? "Everything is engraved. Spend it badly, wear it loudly."
                : consolationOnly
                  ? `${consolationRoast(seed, actNumber)} ${consolationAside(seed)}`
                  : ceremonyLine(seed, actNumber)}
            </DialogDescription>
          </div>

          <ul className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 pb-4 sm:px-6">
            {shown.map((group) => (
              <RewardCard
                key={group.key}
                group={group}
                engraved={engraved.some((e) => e.key === group.key)}
                claiming={claim.isPending && claim.variables?.key === group.key}
                disabled={claim.isPending}
                onClaim={() => claim.mutate(group)}
              />
            ))}
          </ul>

          <div className="flex gap-2 border-t border-[var(--color-gold)]/15 bg-[var(--color-navy-light)]/70 p-4">
            {groups.length > 1 && !consolationOnly ? (
              <Button
                onClick={claimAll}
                disabled={claim.isPending}
                className="h-11 flex-1 bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]"
              >
                Claim everything
              </Button>
            ) : null}
            <Button variant="outline" className={cn("h-11", groups.length > 1 && !consolationOnly ? "" : "flex-1")} onClick={() => close(false)}>
              {done ? "Close the vault" : "Later"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
