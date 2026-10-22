"use client"

import { useMemo, useRef, useState } from "react"
import { MotionConfig } from "motion/react"
import { RefreshCwIcon, ScrollTextIcon } from "lucide-react"
import { toast } from "sonner"
import { useAct } from "@/hooks/use-act"
import { useAuth } from "@/hooks/use-auth"
import { useChaos, useIssueDecree } from "@/hooks/use-chaos"
import { useSession } from "@/hooks/use-session"
import { useLiveSignal } from "@/components/live/live-provider"
import { getActContent } from "@/lib/act-content"
import { BOARD_DECREES, getDecree, type DecreeType } from "@/lib/chaos/catalog"
import { decreeHeadline, decreeToast } from "@/lib/chaos/format"
import {
  DEFAULT_RULES,
  decreeBlock,
  decreeUsage,
  goesIntoDebt,
  ruleFor,
  toBoardAssignments,
  type DecreeContext,
} from "@/lib/chaos/rules"
import type { DecreeRequest } from "@/lib/chaos/schema"
import type { LiveEventPayloads } from "@/lib/live/events"
import type { SessionWithAssignments } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { DECREE_WINDOW_HELP, decreeHelp, decreesPanelHelp } from "@/components/chaos/help"
import { DecreeDialog } from "@/components/chaos/decree-dialog"
import { DecreeLedger, DecreeLedgerSkeleton } from "@/components/chaos/decree-ledger"
import { EdictBoard, EdictBoardSkeleton } from "@/components/chaos/edict-board"
import { Proclamation, useProclamation } from "@/components/chaos/proclamation"
import { TreasuryStrip, TreasuryStripSkeleton } from "@/components/chaos/treasury-strip"
import { formatClock, useRemainingMs } from "@/components/chaos/use-now"

interface ChaosPanelProps {
  session: SessionWithAssignments
  isOpen: boolean
}

interface DialogState {
  type: DecreeType | null
  open: boolean
  nonce: number
  phrase: string
}

function WindowChip({ open, remainingMs }: { open: boolean; remainingMs: number | null }) {
  return (
    <InfoTip help={DECREE_WINDOW_HELP} align="end" className="size-auto">
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tabular-nums",
          open
            ? "border-[var(--color-red-team)]/40 bg-[var(--color-red-team)]/10 text-red-200"
            : "border-[var(--color-gold)]/15 bg-[var(--color-navy)]/60 text-[var(--color-gold-light)]/55"
        )}
      >
        <span
          aria-hidden
          className={cn("size-1.5 rounded-full", open ? "animate-pulse bg-[var(--color-red-team)]" : "bg-[var(--color-gold-light)]/40")}
        />
        {open ? (remainingMs !== null ? `Open · ${formatClock(remainingMs)}` : "Open") : "Closed"}
      </span>
    </InfoTip>
  )
}

export function ChaosPanel({ session, isOpen }: ChaosPanelProps) {
  const { user, profile, signIn } = useAuth()
  const { serverTimeDelta } = useSession()
  const { act } = useAct()
  const remainingMs = useRemainingMs(session.chaos_ends_at, serverTimeDelta)
  const roundOver = session.status !== "chaos"
  const windowOpen = isOpen && !roundOver && (remainingMs === null || remainingMs > 0)
  const { board, isLoading, isError, refetch } = useChaos(session.id, { poll: windowOpen })
  const issue = useIssueDecree(session.id)
  const { item: proclamation, proclaim } = useProclamation()
  const [dialog, setDialog] = useState<DialogState>({ type: null, open: false, nonce: 0, phrase: "" })
  const sealing = useRef(false)

  const assignments = useMemo(() => toBoardAssignments(session), [session])
  const ctx: DecreeContext = useMemo(
    () => ({
      rules: board?.rules ?? DEFAULT_RULES,
      schema: board?.schema ?? "legacy",
      actions: board?.actions ?? [],
      assignments,
      viewer: board?.viewer ?? (user ? { userId: user.id, playerId: profile?.player_id ?? null, balance: null } : null),
      windowOpen,
    }),
    [board, assignments, user, profile?.player_id, windowOpen]
  )

  const cards = BOARD_DECREES.map((def) => {
    const { used, max } = decreeUsage(def.type, ctx)
    return {
      def,
      cost: ruleFor(def.type, ctx.rules).cost,
      used,
      max,
      block: decreeBlock(def.type, ctx),
      debt: goesIntoDebt(def.type, ctx),
      help: decreeHelp(def.type, ctx),
    }
  })

  const viewerId = ctx.viewer?.userId ?? null
  const mine = ctx.actions.filter((a) => a.user_id === viewerId)

  useLiveSignal((signal) => {
    if (signal.kind !== "event" || signal.event.type !== "chaos.decree") return
    if (signal.event.sessionId && signal.event.sessionId !== session.id) return
    const data = signal.event.data as LiveEventPayloads["chaos.decree"]
    if (!getDecree(data.decree)) return
    proclaim({
      id: data.actionId ?? signal.event.id,
      actor: viewerId && signal.event.actor?.userId === viewerId ? "You" : (signal.event.actor?.name ?? "Someone"),
      type: data.decree as DecreeType,
      label: data.label,
      headline: data.headline ?? (data.targetName ? `Target: ${data.targetName}` : ""),
    })
  })

  const openDecree = (type: DecreeType) => {
    issue.reset()
    sealing.current = false
    const phrase = getActContent(act?.act_number ?? 2).getRandomPhrase()
    setDialog((d) => ({ type, open: true, nonce: d.nonce + 1, phrase }))
  }

  const submit = (request: DecreeRequest) => {
    if (sealing.current) return
    sealing.current = true
    issue.mutate(request, {
      onSettled: () => {
        sealing.current = false
      },
      onSuccess: (result) => {
        setDialog((d) => ({ ...d, open: false }))
        const line = decreeToast(result.decree)
        toast.success(line.title, { description: line.description })
        proclaim({
          id: result.decree.id,
          actor: "You",
          type: result.decree.action_type,
          label: getDecree(result.decree.action_type)?.name ?? "A royal decree",
          headline: result.headline || decreeHeadline(result.decree),
        })
      },
    })
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="@container">
        <section
          aria-labelledby="royal-decrees-heading"
          className="relative space-y-3 overflow-hidden rounded-2xl border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)] p-3 @lg:space-y-4 @lg:p-5"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/60 to-transparent"
          />
          <header className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2
                id="royal-decrees-heading"
                className="flex items-center gap-2 font-display text-lg font-semibold tracking-wide text-[var(--color-gold)] @lg:text-xl"
              >
                <ScrollTextIcon aria-hidden className="size-5 shrink-0" />
                Royal Decrees
                <InfoTip help={decreesPanelHelp(ctx.rules, ctx.schema)} align="start" />
              </h2>
              <p className="mt-0.5 text-xs text-[var(--color-gold-light)]/55">
                {windowOpen
                  ? "Issued in the name of the exiled king. Bend the draft before the window slams shut."
                  : "The decree window is closed. What is written is written."}
              </p>
            </div>
            <WindowChip open={windowOpen} remainingMs={remainingMs} />
          </header>

          <Proclamation item={proclamation} />

          {isLoading ? (
            <>
              <TreasuryStripSkeleton />
              <EdictBoardSkeleton />
              <DecreeLedgerSkeleton />
            </>
          ) : isError && !board ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--color-red-team)]/25 bg-[var(--color-red-team)]/5 p-6 text-center">
              <p className="text-sm text-[var(--color-gold-light)]/75">
                The royal scribes dropped the ledger. The decrees are fine, the scribes are not.
              </p>
              <Button variant="outline" onClick={() => refetch()} className="h-10">
                <RefreshCwIcon aria-hidden className="size-4" />
                Try again
              </Button>
            </div>
          ) : (
            <>
              {(ctx.viewer || !roundOver) && (
                <TreasuryStrip
                  signedIn={!!ctx.viewer}
                  balance={ctx.viewer?.balance ?? null}
                  mine={mine}
                  rules={ctx.rules}
                  schema={ctx.schema}
                  onSignIn={signIn}
                />
              )}
              {!roundOver && (
                <>
                  <EdictBoard cards={cards} onSelect={openDecree} />
                  <p className="text-center text-[11px] text-[var(--color-gold-light)]/40">
                    Decrees are final and public. Every point comes back if the game is canceled.
                  </p>
                </>
              )}
              <DecreeLedger entries={ctx.actions} viewerId={viewerId} windowOpen={windowOpen} />
            </>
          )}
        </section>
      </div>

      <DecreeDialog
        key={dialog.nonce}
        type={dialog.type}
        open={dialog.open}
        ctx={ctx}
        remainingMs={windowOpen ? remainingMs : 0}
        pending={issue.isPending}
        error={issue.error?.message ?? null}
        pledgePhrase={dialog.phrase}
        onOpenChange={(open) => {
          if (!open && issue.isPending) return
          setDialog((d) => ({ ...d, open }))
        }}
        onSubmit={submit}
      />
    </MotionConfig>
  )
}
