"use client"

import { useMemo, useState } from "react"
import { LoaderCircleIcon, SwordsIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useMediaQuery } from "@/components/session/use-browser-state"
import { BannerPicker } from "@/components/duels/banner-picker"
import { RivalPicker, type RivalChoice } from "@/components/duels/rival-picker"
import { StakeField } from "@/components/duels/stake-field"
import { useCreateDuel } from "@/components/duels/use-duel-mutations"
import { useDuelRoster } from "@/components/duels/use-duels"
import { TitleInPlay } from "@/components/titles/title-in-play"
import { rivalBlock, rivalsOf, type RivalBlock, type RivalContext } from "@/lib/duels/eligibility"
import { DUEL_COPY } from "@/lib/duels/copy"
import { DUEL_RULES, SIDE_NAME, canAfford, duelPayout, duelProfit, duelTax, isValidStake, otherSide } from "@/lib/duels/rules"
import type { DuelView, Duelist } from "@/lib/duels/types"
import type { SessionWithAssignments, Side } from "@/lib/types"

interface ChallengeSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  session: SessionWithAssignments
  duels: DuelView[]
  me: Duelist
  mySide: Side | null
  balance: number | null
  gatesOpen: boolean
}

export function ChallengeSheet({ open, onOpenChange, ...form }: ChallengeSheetProps) {
  const desktop = useMediaQuery("(min-width: 768px)")
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={desktop ? "right" : "bottom"}
        showCloseButton={false}
        className={
          desktop
            ? "gap-0 overflow-y-auto border-[var(--color-gold)]/25 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
            : "max-h-[92dvh] gap-0 overflow-y-auto rounded-t-2xl border-[var(--color-gold)]/25"
        }
      >
        <ChallengeForm {...form} onDone={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

interface ChallengeFormProps extends Omit<ChallengeSheetProps, "open" | "onOpenChange"> {
  onDone: () => void
}

// The picked rival can become unavailable while the sheet is open (a live challenge, a fresh purse check).
const RIVAL_BLOCKED: Record<RivalBlock, string> = {
  self: "You cannot duel yourself.",
  teammate: "They fight under your banner. Pick a rival from the other side.",
  no_purse: "That rival has no purse yet. Pick another.",
  already: "You two already have a duel this game. Pick another rival.",
}

function blockReason(opts: {
  gatesOpen: boolean
  rival: RivalChoice | null
  rivalMissing: boolean
  rivalBlocked: RivalBlock | null
  hasOpenCall: boolean
  pending: number
  thrown: number
  stake: number
  affordable: boolean
}): string | null {
  if (!opts.gatesOpen) return "The gates just closed. No more challenges this game."
  if (opts.thrown >= DUEL_RULES.maxThrown) return `${DUEL_RULES.maxThrown} gauntlets in one game is plenty.`
  if (opts.rival === null) return "Pick a rival, or throw an open gauntlet."
  if (opts.rivalMissing) return "That rival left the court. Pick another."
  if (opts.rivalBlocked) return RIVAL_BLOCKED[opts.rivalBlocked]
  if (opts.rival === "open" && opts.hasOpenCall) return "You already have an open gauntlet. Withdraw it first."
  if (opts.pending >= DUEL_RULES.maxPending) return `${DUEL_RULES.maxPending} unanswered gauntlets is the limit.`
  if (!isValidStake(opts.stake)) return `Stakes run from ${DUEL_RULES.minStake} to ${DUEL_RULES.maxStake} points.`
  if (!opts.affordable) return `Your purse cannot cover this. The floor is ${DUEL_RULES.debtFloor}.`
  return null
}

function ChallengeForm({ session, duels, me, mySide, balance, gatesOpen, onDone }: ChallengeFormProps) {
  const [side, setSide] = useState<Side>(mySide ?? "blue")
  const [rival, setRival] = useState<RivalChoice | null>(null)
  const [stakeText, setStakeText] = useState("50")
  const roster = useDuelRoster(true)
  const create = useCreateDuel(session.id, session.status, me.userId)

  const sides = useMemo(
    () => new Map(session.session_assignments.map((a) => [a.player_id, a.side] as const)),
    [session.session_assignments]
  )
  const busyWith = useMemo(() => rivalsOf(duels, me.userId), [duels, me.userId])
  const ctx = useMemo<RivalContext>(
    () => ({ viewerId: me.userId, side, sideOfPlayer: (playerId) => sides.get(playerId) ?? null, busyWith }),
    [me.userId, side, sides, busyWith]
  )

  const entries = roster.data?.duelists
  const rivalEntry = rival && rival !== "open" ? entries?.find((e) => e.userId === rival) ?? null : null
  const stake = Number.parseInt(stakeText, 10) || 0
  const affordable = balance === null || canAfford(balance, stake)
  const thrown = duels.filter((d) => d.challenger.userId === me.userId)
  const mine = thrown.filter((d) => d.status === "open")
  const reason = blockReason({
    gatesOpen,
    rival,
    rivalMissing: rival !== null && rival !== "open" && !rivalEntry,
    rivalBlocked: rivalEntry && !create.isPending ? rivalBlock(rivalEntry, ctx) : null,
    hasOpenCall: mine.some((d) => d.isOpen),
    pending: mine.length,
    thrown: thrown.length,
    stake,
    affordable,
  })

  const chooseSide = (next: Side) => {
    setSide(next)
    if (rivalEntry && rivalBlock(rivalEntry, { ...ctx, side: next })) setRival(null)
  }

  const submit = () => {
    if (reason || rival === null || (rival !== "open" && !rivalEntry)) return
    const opponent =
      rival !== "open" && rivalEntry
        ? { userId: rivalEntry.userId, name: rivalEntry.name, avatarUrl: rivalEntry.avatarUrl, playerId: rivalEntry.playerId }
        : null
    create.mutate(
      { side, stake, opponentId: opponent?.userId ?? null, challenger: me, opponent },
      {
        onSuccess: () => {
          toast.success("Gauntlet thrown", {
            description: opponent
              ? `${opponent.name} has until betting closes to answer.`
              : `The whole court can answer with ${SIDE_NAME[otherSide(side)]} until betting closes.`,
          })
          onDone()
        },
      }
    )
  }

  const valid = isValidStake(stake)
  const rivalLabel = rivalEntry ? rivalEntry.name : rival === "open" ? "whoever answers" : "your rival"

  return (
    <div className="flex min-h-0 flex-col">
      <SheetHeader className="relative border-b border-border/60 px-4 pt-4 pb-3 pr-14">
        <SheetTitle className="flex items-center gap-2 font-display text-lg font-semibold text-[var(--color-gold)]">
          <SwordsIcon className="size-[18px]" aria-hidden />
          {DUEL_COPY.cta}
        </SheetTitle>
        <SheetDescription className="text-xs leading-relaxed">
          Name a rival, raise a banner, set the price. Your stake is held until someone answers.
        </SheetDescription>
        <SheetClose
          render={<Button variant="ghost" size="icon" className="absolute top-3 right-3 size-10 rounded-full" />}
        >
          <XIcon className="size-4" aria-hidden />
          <span className="sr-only">Close</span>
        </SheetClose>
      </SheetHeader>

      <div className="space-y-5 px-4 py-4">
        <BannerPicker value={side} onChange={chooseSide} lockedSide={mySide} disabled={create.isPending} />
        <RivalPicker
          roster={entries}
          loading={roster.isPending}
          failed={roster.isError}
          onRetry={() => roster.refetch()}
          value={rival}
          onChange={setRival}
          ctx={ctx}
          disabled={create.isPending}
        />
        <StakeField value={stakeText} onChange={setStakeText} balance={balance} disabled={create.isPending} />
        <TitleInPlay userId={me.userId} context="duel" />
      </div>

      <div className="sticky bottom-0 space-y-2 border-t border-border/60 bg-popover/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        <div className="rounded-xl border border-[var(--color-gold)]/20 bg-[var(--color-navy)]/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <p>
            You ride for <span className="font-semibold text-foreground">{SIDE_NAME[side]}</span> against{" "}
            <span className="font-semibold text-foreground">{rivalLabel}</span> on {SIDE_NAME[otherSide(side)]}.
          </p>
          {valid && (
            <p className="tabular-nums">
              Victory pays <span className="font-semibold text-[var(--color-gold)]">{duelPayout(stake)}</span> (+{duelProfit(stake)} after a{" "}
              {duelTax(stake)} point tithe)
              {balance !== null && (
                <>
                  {" "}
                  · Purse {balance} to <span className={balance - stake < 0 ? "text-[var(--color-red-team)]" : undefined}>{balance - stake}</span>
                </>
              )}
            </p>
          )}
        </div>
        <Button
          onClick={submit}
          disabled={!!reason || create.isPending}
          className="h-12 w-full rounded-xl bg-[var(--color-gold)] text-base font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]"
        >
          {create.isPending ? <LoaderCircleIcon className="size-4 animate-spin" aria-hidden /> : <SwordsIcon className="size-4" aria-hidden />}
          {valid ? `Throw the gauntlet · ${stake}` : "Throw the gauntlet"}
        </Button>
        <p aria-live="polite" className="min-h-4 text-center text-[11px] text-muted-foreground">
          {reason ?? " "}
        </p>
      </div>
    </div>
  )
}
