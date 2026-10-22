"use client"

import { useId, useRef, useState, type FormEvent } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { CrosshairIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { HelpRows, InfoTip } from "@/components/ui/info-tip"
import { DebtPledgeDialog } from "@/components/debt-pledge-dialog"
import { AmountPicker } from "@/components/bounties/amount-picker"
import { PlayerPicker } from "@/components/bounties/player-picker"
import { SelectedPlayer } from "@/components/bounties/selected-player"
import { isMigrationPending } from "@/components/bounties/request"
import { useBountyBoard, usePledge, useRoster } from "@/components/bounties/use-bounties"
import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import { WARRANT_COPY } from "@/lib/bounties/copy"
import { WARRANT_HELP, pledgeHelp } from "@/lib/bounties/help"
import { BOUNTY_RULES, nextEscapeBonus } from "@/lib/bounties/rules"
import type { WarrantView } from "@/lib/bounties/types"

interface BountyDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialTargetId?: string | null
  onPlaced?: () => void
}

export function BountyDialog({ open, onOpenChange, initialTargetId = null, onPlaced }: BountyDialogProps) {
  const popupRef = useRef<HTMLDivElement>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={popupRef}
        initialFocus={(type) => (type === "keyboard" ? true : popupRef.current)}
        className="max-h-[92dvh] overflow-y-auto border border-[var(--color-red-team)]/30 bg-[var(--color-navy-light)] sm:max-w-md"
      >
        {open && <PledgeForm key={initialTargetId ?? "new"} initialTargetId={initialTargetId} onDone={onPlaced} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function warrantHint(warrant: WarrantView | undefined): string | null {
  if (!warrant) return null
  const backers = warrant.backers.length
  return `Wanted: ${warrant.price} pts, ${backers} ${backers === 1 ? "backer" : "backers"}`
}

function PledgeForm({ initialTargetId, onDone, onClose }: { initialTargetId: string | null; onDone?: () => void; onClose: () => void }) {
  const ids = useId()
  const reduce = useReducedMotion()
  const { user, profile, signIn } = useAuth()
  const userId = user?.id ?? null
  const { balance, isLoading: balanceLoading } = usePoints(userId)
  const roster = useRoster()
  const board = useBountyBoard(userId)
  const pledge = usePledge(userId)
  const [targetId, setTargetId] = useState<string | null>(initialTargetId)
  const [amountText, setAmountText] = useState(String(BOUNTY_RULES.minPledge))
  const [pledgeOpen, setPledgeOpen] = useState(false)

  const myPlayerId = board.data?.viewer.playerId ?? profile?.player_id ?? null
  const openWarrants = (board.data?.warrants ?? []).filter((w) => w.kind === "warrant")
  const warrantFor = (playerId: string) => openWarrants.find((w) => w.target.playerId === playerId)
  const target = (roster.data ?? []).find((p) => p.playerId === targetId) ?? null
  const existing = target ? warrantFor(target.playerId) : undefined
  const mine = existing?.mine ?? 0
  const purse = userId && !balanceLoading ? balance : null
  const amount = Number.parseInt(amountText, 10) || 0
  const capLeft = BOUNTY_RULES.maxBackerTotal - mine
  const affordable = purse === null ? capLeft : Math.min(capLeft, purse - BOUNTY_RULES.debtFloor)
  const price = (existing?.price ?? 0) + amount
  const pledged = (existing?.pledged ?? 0) + amount
  const escapeBonus = nextEscapeBonus(pledged, existing?.crownBonus ?? 0)
  const unavailable = board.data ? !board.data.available : false

  const reason = !target
    ? "Pick a head first."
    : capLeft < BOUNTY_RULES.minPledge
      ? `You already put ${mine} on ${target.name}. That is the limit.`
      : amount < BOUNTY_RULES.minPledge
        ? `At least ${BOUNTY_RULES.minPledge} points.`
        : amount > capLeft
          ? `At most ${capLeft} more from you on this head.`
          : amount > affordable
            ? `Debt limit reached (${BOUNTY_RULES.debtFloor}). Even Salaxe's notebook has a last page.`
            : null

  const execute = () => {
    if (!target || !userId) return
    const me = {
      userId,
      name: profile?.players?.name ?? profile?.discord_username ?? "You",
      avatarUrl: profile?.discord_avatar_url ?? null,
    }
    pledge.mutate(
      { target, amount, me },
      {
        onSuccess: (result) => {
          toast.success(
            result.created ? `Warrant signed. ${result.targetName}'s head is worth ${result.price}.` : `The price on ${result.targetName} rises to ${result.price}.`,
            { description: "The next team that beats them splits it." }
          )
          onDone?.()
          onClose()
        },
        onError: (error) => toast.error(isMigrationPending(error) ? WARRANT_COPY.pending : error.message),
      }
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (reason || pledge.isPending || unavailable) return
    if (purse !== null && purse - amount < 0) {
      setPledgeOpen(true)
      return
    }
    execute()
  }

  return (
    <>
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          <div className="flex items-center gap-2 pr-8">
            <DialogTitle className="flex items-center gap-2 font-display text-xl text-[var(--color-gold-light)]">
              <CrosshairIcon aria-hidden className="size-5 text-[var(--color-red-team)]" />
              Sign a royal warrant
            </DialogTitle>
            <InfoTip help={WARRANT_HELP.pledge} side="bottom" align="start" />
          </div>
          <DialogDescription>Price a head. The next team that beats them splits the pot. Unclaimed in a week, you get it back.</DialogDescription>
        </DialogHeader>

        {!userId ? (
          <Button type="button" onClick={signIn} className="h-11 rounded-xl bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]">
            {WARRANT_COPY.loginHint}
          </Button>
        ) : (
          <>
            {target ? (
              <SelectedPlayer
                label="Whose head"
                player={target}
                hint={warrantHint(existing) ?? "No warrant yet: you print the poster."}
                disabled={pledge.isPending}
                onChange={() => setTargetId(null)}
              />
            ) : (
              <PlayerPicker
                id={`${ids}-target`}
                label="Whose head"
                players={roster.data}
                loading={roster.isPending}
                error={roster.isError}
                onRetry={() => roster.refetch()}
                value={targetId}
                onChange={setTargetId}
                blockedReason={(p) => (p.playerId === myPlayerId ? "That is you. Bold, but no." : null)}
                hint={(p) => warrantHint(warrantFor(p.playerId))}
                meta={(p) => {
                  const w = warrantFor(p.playerId)
                  return w ? (
                    <span className="shrink-0 rounded-full bg-[var(--color-red-team)]/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--color-red-team)]">
                      {w.price}
                    </span>
                  ) : null
                }}
              />
            )}

            <AnimatePresence initial={false}>
              {target && (
                <motion.div
                  key="amount"
                  initial={reduce ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  className="grid gap-4 overflow-hidden"
                >
                  <AmountPicker id={`${ids}-amount`} value={amountText} onChange={setAmountText} purse={purse} max={Math.max(affordable, 0)} disabled={pledge.isPending} />
                  <div className="space-y-2 rounded-xl border border-[var(--color-red-team)]/25 bg-[var(--color-red-team)]/5 p-3">
                    <p className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="uppercase tracking-[0.18em] text-muted-foreground">{existing ? "New price" : "Price"}</span>
                      <span className="font-display text-lg font-bold tabular-nums text-[var(--color-gold)]">{price} pts</span>
                    </p>
                    <HelpRows help={pledgeHelp({ targetName: target.name, amount, price, escapeBonus, refund: mine + amount })} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {unavailable && <p className="text-center text-xs text-muted-foreground">{WARRANT_COPY.pending}</p>}
            {!unavailable && target && reason && (
              <p className="text-center text-xs text-[var(--color-red-team)]" role="status">
                {reason}
              </p>
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
              disabled={!!reason || pledge.isPending || unavailable}
              className="h-10 bg-[var(--color-red-team)] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-red-team)]/85"
            >
              {pledge.isPending ? "Signing..." : target ? `Sign the warrant · ${amount}` : "Sign the warrant"}
            </Button>
          )}
        </DialogFooter>
      </form>
      <DebtPledgeDialog
        open={pledgeOpen}
        onOpenChange={setPledgeOpen}
        currentBalance={purse ?? 0}
        cost={amount}
        actionLabel="warrant"
        onConfirm={execute}
      />
    </>
  )
}
