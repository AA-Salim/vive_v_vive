"use client"

import type { ReactNode } from "react"
import { AnimatePresence } from "motion/react"
import { CoinsIcon, LogInIcon, SwordsIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DuelActions, type ActionViewer } from "@/components/duels/duel-actions"
import { DuelRules } from "@/components/duels/duel-rules"
import { DuelShell } from "@/components/duels/duel-shell"
import { IncomingGauntlet } from "@/components/duels/incoming-gauntlet"
import { VerdictSummary } from "@/components/duels/verdict-summary"
import { VersusCard } from "@/components/duels/versus-card"
import { DUEL_COPY } from "@/lib/duels/copy"
import type { DuelAction, DuelView } from "@/lib/duels/types"

export interface DuelGroups {
  incoming: DuelView[]
  mine: DuelView[]
  openCalls: DuelView[]
  awaiting: DuelView[]
  sworn: DuelView[]
  settled: DuelView[]
  unanswered: number
}

const involves = (duel: DuelView, viewerId: string | null) =>
  !!viewerId && (duel.challenger.userId === viewerId || duel.opponent?.userId === viewerId)

// The viewer's own fights first, then everyone else's, newest gauntlets last.
const viewerFirst = (viewerId: string | null) => (a: DuelView, b: DuelView) =>
  Number(involves(b, viewerId)) - Number(involves(a, viewerId))

export function groupDuels(duels: DuelView[], viewerId: string | null): DuelGroups {
  const open = duels.filter((d) => d.status === "open")
  const incoming = open.filter((d) => !d.isOpen && !!viewerId && d.opponent?.userId === viewerId)
  const live = duels.filter((d) => d.status === "open" || d.status === "accepted")
  return {
    incoming,
    mine: live.filter((d) => involves(d, viewerId) && !incoming.includes(d)),
    openCalls: open.filter((d) => d.isOpen && !involves(d, viewerId)),
    awaiting: open.filter((d) => !d.isOpen && !involves(d, viewerId)),
    sworn: duels.filter((d) => d.status === "accepted").sort(viewerFirst(viewerId)),
    settled: duels.filter((d) => d.status === "won" || d.status === "lost").sort(viewerFirst(viewerId)),
    unanswered: open.length,
  }
}

function potOf(duels: DuelView[]): number {
  return duels.reduce((sum, d) => sum + d.stake * 2, 0)
}

function PotChip({ duels }: { duels: DuelView[] }) {
  const pot = potOf(duels)
  if (pot === 0) return null
  return (
    <span className="flex h-8 items-center gap-1 rounded-full bg-[var(--color-gold)]/10 px-2.5 text-xs font-semibold tabular-nums text-[var(--color-gold)]">
      <CoinsIcon className="size-3.5" aria-hidden />
      <span className="sr-only">Points riding on duels:</span>
      {pot}
    </span>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h4 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold-light)]/70">
        {title}
        <span className="rounded-full bg-muted px-1.5 py-px text-[10px] tabular-nums text-muted-foreground">{count}</span>
      </h4>
      <div className="space-y-2">
        <AnimatePresence initial={false}>{children}</AnimatePresence>
      </div>
    </section>
  )
}

export interface ActionState {
  viewer: ActionViewer
  rivals: ReadonlySet<string>
  pendingFor: (duel: DuelView) => DuelAction | null
  onAction: (duel: DuelView, action: DuelAction) => void
  onSignIn: () => void
}

interface OpenViewProps {
  groups: DuelGroups
  all: DuelView[]
  highlights: ReadonlySet<string>
  actions: ActionState
  signedIn: boolean
  authLoading: boolean
  gatesOpen: boolean
  onChallenge: () => void
}

export function OpenView({ groups, all, highlights, actions, signedIn, authLoading, gatesOpen, onChallenge }: OpenViewProps) {
  const viewerId = actions.viewer.userId
  const card = (duel: DuelView) => {
    const pending = actions.pendingFor(duel)
    return (
      <VersusCard key={duel.id} duel={duel} viewerId={viewerId} highlight={highlights.has(duel.id)}>
        {duel.status === "open" &&
        (duel.isOpen || duel.challenger.userId === viewerId) &&
        !duel.id.startsWith("optimistic-") ? (
          <DuelActions
            duel={duel}
            viewer={actions.viewer}
            rivals={actions.rivals}
            pendingAction={pending}
            busy={pending !== null}
            onAction={actions.onAction}
            onSignIn={actions.onSignIn}
          />
        ) : null}
      </VersusCard>
    )
  }
  const glance = (duel: DuelView) => (
    <VersusCard key={duel.id} duel={duel} viewerId={viewerId} compact highlight={highlights.has(duel.id)} />
  )
  const othersSworn = groups.sworn.filter((d) => !involves(d, viewerId))
  const empty = groups.incoming.length + groups.mine.length + groups.openCalls.length + othersSworn.length + groups.awaiting.length === 0

  return (
    <DuelShell
      subtitle={DUEL_COPY.subtitle.open}
      aside={
        <>
          <PotChip duels={groups.sworn} />
          <DuelRules />
        </>
      }
    >
      <AnimatePresence initial={false}>
        {viewerId &&
          groups.incoming.map((duel) => {
            const pending = actions.pendingFor(duel)
            return (
              <IncomingGauntlet
                key={duel.id}
                duel={duel}
                viewerId={viewerId}
                balance={actions.viewer.balance}
                pendingAction={pending}
                busy={pending !== null}
                highlight={highlights.has(duel.id)}
                onAction={actions.onAction}
              />
            )
          })}
      </AnimatePresence>

      {signedIn ? (
        <Button
          onClick={onChallenge}
          disabled={!gatesOpen}
          variant="outline"
          className="h-auto min-h-12 w-full justify-start gap-3 rounded-xl border-[var(--color-gold)]/45 bg-[var(--color-gold)]/[0.07] px-3 py-2.5 text-left hover:border-[var(--color-gold)] hover:bg-[var(--color-gold)]/15"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--color-gold)] text-[var(--color-navy)]">
            <SwordsIcon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block font-display text-sm font-semibold text-[var(--color-gold)]">{DUEL_COPY.cta}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{DUEL_COPY.ctaHint}</span>
          </span>
        </Button>
      ) : (
        <div className="flex flex-col items-center gap-2.5 rounded-xl border border-dashed border-[var(--color-gold)]/30 px-4 py-4 text-center">
          <p className="text-xs leading-relaxed text-muted-foreground">{DUEL_COPY.signInHint}</p>
          <Button onClick={actions.onSignIn} disabled={authLoading} variant="outline" className="h-10 gap-1.5 px-4">
            <LogInIcon className="size-4" aria-hidden />
            {DUEL_COPY.signIn}
          </Button>
        </div>
      )}

      {groups.mine.length > 0 && (
        <Section title={DUEL_COPY.mineKicker} count={groups.mine.length}>
          {groups.mine.map(card)}
        </Section>
      )}
      {groups.openCalls.length > 0 && (
        <Section title={DUEL_COPY.openKicker} count={groups.openCalls.length}>
          {groups.openCalls.map(card)}
        </Section>
      )}
      {othersSworn.length > 0 && (
        <Section title={DUEL_COPY.swornKicker} count={othersSworn.length}>
          {othersSworn.map(glance)}
        </Section>
      )}
      {groups.awaiting.length > 0 && (
        <Section title={DUEL_COPY.awaitingKicker} count={groups.awaiting.length}>
          {groups.awaiting.map(glance)}
        </Section>
      )}
      {empty && (
        <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs leading-relaxed text-muted-foreground">
          {all.length > 0 ? DUEL_COPY.emptyRetired : DUEL_COPY.empty}
        </p>
      )}
    </DuelShell>
  )
}

// Settled rows stay visible here: the duel hook pays out a moment before the session flips to its result.
export function LockedView({ groups, viewerId, highlights }: { groups: DuelGroups; viewerId: string | null; highlights: ReadonlySet<string> }) {
  const shown = [...groups.sworn, ...groups.settled]
  if (shown.length === 0) return null
  return (
    <DuelShell subtitle={DUEL_COPY.subtitle.locked} aside={<PotChip duels={shown} />}>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {shown.map((duel) => (
            <VersusCard key={duel.id} duel={duel} viewerId={viewerId} compact highlight={highlights.has(duel.id)} />
          ))}
        </AnimatePresence>
      </div>
      {groups.unanswered > 0 && <p className="text-[11px] leading-relaxed text-muted-foreground">{DUEL_COPY.lockedNote}</p>}
    </DuelShell>
  )
}

export function ResultView({ groups, viewerId, highlights }: { groups: DuelGroups; viewerId: string | null; highlights: ReadonlySet<string> }) {
  const shown = [...groups.settled, ...groups.sworn]
  if (shown.length === 0) return null
  return (
    <DuelShell subtitle={DUEL_COPY.subtitle.result} aside={<PotChip duels={shown} />}>
      {viewerId && <VerdictSummary duels={groups.settled} viewerId={viewerId} />}
      <Section title={DUEL_COPY.verdictKicker} count={shown.length}>
        {shown.map((duel) => (
          <VersusCard key={duel.id} duel={duel} viewerId={viewerId} highlight={highlights.has(duel.id)} />
        ))}
      </Section>
    </DuelShell>
  )
}
