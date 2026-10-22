"use client"

import { useId, useRef, useState, type FormEvent } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { MegaphoneIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DebtPledgeDialog } from "@/components/debt-pledge-dialog"
import { PlayerPicker } from "@/components/bounties/player-picker"
import { SelectedPlayer } from "@/components/bounties/selected-player"
import { isMigrationPending } from "@/components/bounties/request"
import { formatTimeLeft, useMsLeft } from "@/components/bounties/time-left"
import { useRoster } from "@/components/bounties/use-bounties"
import { RoastPicker } from "@/components/shame/roast-picker"
import { usePilloryPreview, usePilloryWall, usePostPillory } from "@/components/shame/use-pillory"
import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import { PILLORY_COPY } from "@/lib/bounties/copy"
import { roastsFor } from "@/lib/bounties/roasts"
import { PILLORY_RULES } from "@/lib/bounties/rules"
import type { ShameStatKey } from "@/lib/bounties/types"

interface ShameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTargetId?: string | null
  onSuccess?: () => void
}

export function ShameDialog({ open, onOpenChange, initialTargetId = null, onSuccess }: ShameDialogProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={popupRef}
        initialFocus={(type) => (type === "keyboard" ? true : popupRef.current)}
        className="max-h-[92dvh] overflow-y-auto border border-[var(--color-gold)]/25 bg-[var(--color-navy-light)] sm:max-w-lg"
      >
        {open && <PilloryForm key={initialTargetId ?? "new"} initialTargetId={initialTargetId} onDone={onSuccess} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function PilloryForm({ initialTargetId, onDone, onClose }: { initialTargetId: string | null; onDone?: () => void; onClose: () => void }) {
  const ids = useId()
  const reduce = useReducedMotion()
  const { user, profile, signIn } = useAuth()
  const userId = user?.id ?? null
  const { balance, isLoading: balanceLoading } = usePoints(userId)
  const roster = useRoster()
  const wall = usePilloryWall(userId)
  const post = usePostPillory(userId)
  const [targetId, setTargetId] = useState<string | null>(initialTargetId)
  const [statKey, setStatKey] = useState<ShameStatKey | null>(null)
  const [seed, setSeed] = useState(0)
  const [draft, setDraft] = useState<string | null>(null)
  const [pledgeOpen, setPledgeOpen] = useState(false)
  const preview = usePilloryPreview(targetId)
  const cooldownLeft = useMsLeft(wall.data?.viewer.nextPostAt ?? null)

  const myPlayerId = wall.data?.viewer.playerId ?? profile?.player_id ?? null
  const onWall = new Set((wall.data?.entries ?? []).filter((e) => e.kind === "user").map((e) => e.target.playerId))
  const target = (roster.data ?? []).find((p) => p.playerId === targetId) ?? null
  const previewData = preview.data && preview.data.playerId === targetId ? preview.data : undefined
  const stats = previewData ? [previewData.stat, ...previewData.alternatives] : []
  const stat = stats.find((s) => s.key === statKey) ?? stats[0] ?? null
  const suggestions = stat && target ? roastsFor(stat, target.name, seed) : []
  const message = draft ?? suggestions[0] ?? ""
  const trimmed = message.trim()
  const purse = userId && !balanceLoading ? balance : null
  const unavailable = wall.data ? !wall.data.available : false
  const coolingDown = cooldownLeft !== null && cooldownLeft > 0

  const reason = !target
    ? "Pick a sinner first."
    : coolingDown
      ? `Your next pillory is ready in ${formatTimeLeft(cooldownLeft ?? 0)}.`
      : !stat
        ? "Reading their record..."
        : trimmed.length === 0
          ? "Pick a roast or write one."
          : trimmed.length > PILLORY_RULES.messageMax
            ? `Keep it under ${PILLORY_RULES.messageMax} characters.`
            : purse !== null && purse - PILLORY_RULES.cost < PILLORY_RULES.debtFloor
              ? `Debt limit reached (${PILLORY_RULES.debtFloor}). Even Salaxe's notebook has a last page.`
              : null

  const pickTarget = (playerId: string | null) => {
    setTargetId(playerId)
    setStatKey(null)
    setDraft(null)
    setSeed(0)
  }

  const execute = () => {
    if (!target || !stat || !userId) return
    post.mutate(
      {
        targetPlayerId: target.playerId,
        message: trimmed,
        statKey: stat.key,
        target,
        stat: { label: stat.label, value: stat.value },
        me: { userId, name: profile?.players?.name ?? profile?.discord_username ?? "You", avatarUrl: profile?.discord_avatar_url ?? null },
      },
      {
        onSuccess: (result) => {
          toast.success(`Nailed. ${result.targetName} is on the wall for ${PILLORY_RULES.hours} hours.`, {
            description: "Eggs are free. Tell the court.",
          })
          onDone?.()
          onClose()
        },
        onError: (error) => toast.error(isMigrationPending(error) ? PILLORY_COPY.pending : error.message),
      }
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (reason || post.isPending || unavailable) return
    if (purse !== null && purse - PILLORY_RULES.cost < 0) {
      setPledgeOpen(true)
      return
    }
    execute()
  }

  return (
    <>
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-xl text-[var(--color-gold-light)]">
            <MegaphoneIcon aria-hidden className="size-5 text-[var(--color-red-team)]" />
            Nail someone to the pillory
          </DialogTitle>
          <DialogDescription>
            {PILLORY_RULES.cost} points, {PILLORY_RULES.hours} hours on the wall, their worst real stat in big letters. Everyone gets to throw eggs.
          </DialogDescription>
        </DialogHeader>

        {!userId ? (
          <Button type="button" onClick={signIn} className="h-11 rounded-xl bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]">
            {PILLORY_COPY.loginHint}
          </Button>
        ) : (
          <>
            {target ? (
              <SelectedPlayer
                label="The sinner"
                tone="roast"
                player={target}
                hint={stat ? `${stat.label}: ${stat.value}` : "Reading their record..."}
                disabled={post.isPending}
                onChange={() => pickTarget(null)}
              />
            ) : (
              <PlayerPicker
                id={`${ids}-target`}
                label="The sinner"
                tone="roast"
                players={roster.data}
                loading={roster.isPending}
                error={roster.isError}
                onRetry={() => roster.refetch()}
                value={targetId}
                onChange={pickTarget}
                blockedReason={(p) =>
                  p.playerId === myPlayerId ? "That is you. Therapy is down the hall." : onWall.has(p.playerId) ? "Already on the wall. Egg them instead." : null
                }
              />
            )}

            <AnimatePresence initial={false}>
              {target && (
                <motion.div
                  key="roast"
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <RoastPicker
                    id={ids}
                    preview={previewData}
                    loading={preview.isPending}
                    error={preview.isError}
                    onRetry={() => preview.refetch()}
                    statKey={stat?.key ?? null}
                    onStatChange={(key) => {
                      setStatKey(key)
                      setDraft(null)
                    }}
                    suggestions={suggestions}
                    message={message}
                    onMessageChange={setDraft}
                    onShuffle={() => {
                      setSeed((s) => s + 1)
                      setDraft(null)
                    }}
                    disabled={post.isPending}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <p className="flex items-center justify-between gap-2 rounded-xl border border-border bg-[var(--color-navy)]/60 px-3 py-2 text-xs text-muted-foreground">
              <span>
                Costs <span className="font-semibold text-[var(--color-gold-light)]">{PILLORY_RULES.cost}</span>
              </span>
              {purse !== null && (
                <span className="tabular-nums">
                  Purse {purse} <span aria-hidden>→</span>
                  <span className="sr-only">after:</span> <span className={purse - PILLORY_RULES.cost < 0 ? "text-[var(--color-red-team)]" : "text-[var(--color-gold-light)]"}>{purse - PILLORY_RULES.cost}</span>
                </span>
              )}
            </p>

            {unavailable ? (
              <p className="text-center text-xs text-muted-foreground">{PILLORY_COPY.pending}</p>
            ) : (
              target &&
              reason && (
                <p className="text-center text-xs text-[var(--color-red-team)]" role="status">
                  {reason}
                </p>
              )
            )}
          </>
        )}

        <DialogFooter className="sticky bottom-0 z-10 bg-[var(--color-navy-light)]">
          <Button type="button" variant="outline" onClick={onClose} className="h-10">
            Cancel
          </Button>
          {userId && (
            <Button
              type="submit"
              disabled={!!reason || post.isPending || unavailable}
              className="h-10 bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]"
            >
              {post.isPending ? "Nailing..." : `Pillory · ${PILLORY_RULES.cost}`}
            </Button>
          )}
        </DialogFooter>
      </form>
      <DebtPledgeDialog
        open={pledgeOpen}
        onOpenChange={setPledgeOpen}
        currentBalance={purse ?? 0}
        cost={PILLORY_RULES.cost}
        actionLabel="pillory"
        onConfirm={execute}
      />
    </>
  )
}
