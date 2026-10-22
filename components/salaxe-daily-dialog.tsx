"use client"

import { Fragment, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import { CoinsIcon, NewspaperIcon, ScrollTextIcon, SkullIcon, SparklesIcon } from "lucide-react"
import { useActIntroPending } from "@/components/act-intro-modal"
import { LoreText } from "@/components/lore/lore-text"
import { useVisibleViewport } from "@/components/lore/use-visible-viewport"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { InfoTip } from "@/components/ui/info-tip"
import { useAct } from "@/hooks/use-act"
import { useChronicle } from "@/hooks/use-chronicle"
import { useSession } from "@/hooks/use-session"
import { getActContent } from "@/lib/act-content"
import { FREE, pts, type HelpEntry } from "@/lib/help"
import { TIMED_STATUSES } from "@/lib/live/events"
import type { DailyClaim } from "@/hooks/use-points"
import { useMyTitleEffects } from "@/hooks/use-title-effects"
import { DAILY_STIPEND } from "@/lib/lore/daily"
import { pick } from "@/lib/lore/seed"
import { noteChip, stipendTerms, type CombinedEffects } from "@/lib/titles/effects"
import { cn } from "@/lib/utils"

const STIPEND_HELP: HelpEntry = {
  title: "The daily stipend",
  does: "Salaxe feeds his subjects a small allowance on their first visit of the day. It lands in your purse by itself, nothing to click.",
  cost: FREE,
  reward: `${pts(DAILY_STIPEND)} a day.`,
  limits: "Once per day for signed-in subjects, paid on your first visit. Resets at midnight UTC.",
}

interface SalaxeDailyDialogProps {
  open: boolean
  claim?: DailyClaim | null
  onDismiss: () => void
  username: string
}

const NAME_TOKEN = "\u0000"

interface StipendView {
  amount: number
  toSalaxe: boolean
  chips: string[]
}

// What today's stipend paid, from the claim when the server reports it, else from the viewer's titles.
function stipendView(claim: DailyClaim | null | undefined, fx: CombinedEffects): StipendView {
  const local = stipendTerms(fx)
  const serverLines = Array.isArray(claim?.title_effects)
    ? claim.title_effects.filter((line): line is string => typeof line === "string" && line.length > 0).slice(0, 3)
    : []
  const amount = typeof claim?.amount === "number" ? claim.amount : fx.size > 0 ? local.amount : DAILY_STIPEND
  const toSalaxe = typeof claim?.paid_to_salaxe === "boolean" ? claim.paid_to_salaxe : local.toSalaxe
  const chips = serverLines.length > 0 ? serverLines : local.notes.map(noteChip)
  return { amount, toSalaxe, chips }
}

export function SalaxeDailyDialog({ open, claim, onDismiss, username }: SalaxeDailyDialogProps) {
  const { fx } = useMyTitleEffects()
  const stipend = stipendView(claim, fx)
  const { act, isLoading: actLoading } = useAct()
  const { session, isLoading: sessionLoading } = useSession()
  const introPending = useActIntroPending()
  const reduceMotion = useReducedMotion() ?? false
  const pinned = useVisibleViewport(448)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [closed, setClosed] = useState(false)
  const [day] = useState(() => new Date().toISOString().slice(0, 10))
  const busy = sessionLoading || (!!session && TIMED_STATUSES.includes(session.status))
  const visible = open && !closed && !actLoading && !introPending && !busy
  const chronicle = useChronicle(visible)

  const content = getActContent(act?.act_number ?? 2)
  const quote = content.getDailyQuote(`${day}:${username}`)
  const parts = quote.body(NAME_TOKEN).split(NAME_TOKEN)
  const gazette = chronicle.data?.gazette ?? []
  const intel = gazette.length > 0 ? pick(gazette, `${day}:intel:${username}`) : null

  const dismiss = () => {
    setClosed(true)
    onDismiss()
  }

  return (
    <Dialog open={visible} onOpenChange={(next) => !next && dismiss()}>
      <DialogContent
        showCloseButton={false}
        initialFocus={buttonRef}
        style={pinned}
        className="max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-md gap-0 overflow-x-hidden overflow-y-auto border border-[var(--color-gold)]/35 bg-[var(--color-navy)] p-0 shadow-2xl shadow-black/60 sm:max-w-md"
      >
        <div className="relative px-5 pt-7 pb-5 text-center sm:px-7">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)] to-transparent" />
          <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-80 -translate-x-1/2 rounded-full bg-[var(--color-gold)]/12 blur-3xl" />

          <motion.span
            initial={reduceMotion ? false : { scale: 0.6, rotate: -25, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="relative mx-auto grid size-14 place-items-center rounded-full border border-[var(--color-gold)]/40 bg-linear-to-b from-[var(--color-gold-dark)]/70 to-[var(--color-navy-light)] shadow-lg shadow-black/40"
          >
            <ScrollTextIcon className="size-6 text-[var(--color-gold)]" aria-hidden />
          </motion.span>

          <p className="relative mt-4 text-[11px] font-semibold tracking-[0.22em] text-[var(--color-gold)]/80 uppercase">
            {content.dailyKicker}
          </p>
          <DialogTitle className="relative mt-1.5 font-display text-2xl leading-tight font-semibold text-balance text-[var(--color-gold-light)]">
            {quote.title}
          </DialogTitle>
          <DialogDescription className="relative mt-3 text-sm leading-relaxed text-pretty text-[var(--color-gold-light)]/80">
            {parts.map((part, i) => (
              <Fragment key={i}>
                {i > 0 && <strong className="font-semibold text-[var(--color-gold)]">{username}</strong>}
                {part}
              </Fragment>
            ))}
          </DialogDescription>

          <div className="relative mt-5 flex items-center justify-center gap-2">
            <motion.div
              initial={reduceMotion ? false : { y: 10, opacity: 0, scale: 0.9 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ delay: reduceMotion ? 0 : 0.3, type: "spring", stiffness: 300, damping: 20 }}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-1.5",
                stipend.toSalaxe ? "border-rose-400/40 bg-rose-500/10" : "border-[var(--color-gold)]/35 bg-[var(--color-gold)]/10"
              )}
            >
              {stipend.toSalaxe ? (
                <SkullIcon className="size-4 text-rose-300" aria-hidden />
              ) : (
                <CoinsIcon className="size-4 text-[var(--color-gold)]" aria-hidden />
              )}
              <span
                className={cn(
                  "font-display text-lg font-semibold tabular-nums",
                  stipend.toSalaxe ? "text-rose-200 line-through decoration-rose-300/70" : "text-[var(--color-gold)]"
                )}
              >
                +{stipend.amount}
              </span>
              <span className={cn("text-xs", stipend.toSalaxe ? "text-rose-100/80" : "text-[var(--color-gold-light)]/70")}>
                {stipend.toSalaxe ? "paid to Salaxe instead (cursed)" : "points to your purse"}
              </span>
            </motion.div>
            <InfoTip help={STIPEND_HELP} side="top" />
          </div>

          {stipend.chips.length > 0 && (
            <div className="relative mt-2 flex flex-wrap justify-center gap-1.5">
              {stipend.chips.map((chip) => (
                <span
                  key={chip}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                    stipend.toSalaxe
                      ? "border-rose-400/40 bg-rose-500/10 text-rose-100"
                      : "border-[var(--color-gold)]/40 bg-[var(--color-gold)]/10 text-[var(--color-gold-light)]"
                  )}
                >
                  <SparklesIcon className="size-3" aria-hidden />
                  {chip}
                </span>
              ))}
            </div>
          )}

          {intel && (
            <div className="relative mt-5 rounded-lg border border-border bg-[var(--color-navy-light)]/70 px-3 py-2.5 text-left">
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-[var(--color-gold)]/70 uppercase">
                <NewspaperIcon className="size-3" aria-hidden />
                Court intelligence
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                <LoreText segments={intel.segments} />
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-[var(--color-gold)]/15 bg-[var(--color-navy-light)]/70 p-4">
          <Button
            ref={buttonRef}
            onClick={dismiss}
            className="h-11 w-full bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]"
          >
            {quote.dismiss}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
