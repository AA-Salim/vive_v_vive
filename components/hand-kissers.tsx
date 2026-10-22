"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowRightIcon, ChevronDownIcon, CrownIcon, HandHeartIcon } from "lucide-react"
import { PlayerAvatar } from "@/components/pages/avatars"
import { formatNumber } from "@/components/pages/format"
import { useKissBoard } from "@/components/pages/queries"
import { ComposerDialog } from "@/components/praise/composer-dialog"
import { ProfileTrigger } from "@/components/profile/profile-provider"
import { useMediaQuery } from "@/components/session/use-browser-state"
import { PlayerName } from "@/components/titles/player-name"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthUser } from "@/hooks/use-auth"
import { usePraiseState } from "@/hooks/use-praise"
import { KISS_BOARD_HREF } from "@/lib/pages/constants"
import { KISS_BOARD_HELP } from "@/lib/pages/help"
import { seasonShort } from "@/lib/pages/season-calendar"
import type { KissEntry } from "@/lib/pages/types"
import { cn } from "@/lib/utils"

const LABEL = "text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase"

// Set where the panel is already shown above the court (the collapsed court on phones), so it is not shown twice.
const ShownAbove = createContext(false)

export function HandKissersShownAbove({ children }: { children: ReactNode }) {
  return <ShownAbove.Provider value={true}>{children}</ShownAbove.Provider>
}

function TodayRow({ entry, mine }: { entry: KissEntry; mine: boolean }) {
  const praise = entry.recent[0]
  return (
    <li className="flex min-w-0 items-start gap-2.5">
      <ProfileTrigger playerId={entry.playerId} name={entry.name} className="mt-0.5 shrink-0 rounded-full">
        <PlayerAvatar name={entry.name} src={entry.avatarUrl} size="sm" ring={mine ? "gold" : null} />
      </ProfileTrigger>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-sm">
          <ProfileTrigger playerId={entry.playerId} name={entry.name} className="min-w-0 font-semibold text-[var(--color-gold-light)]">
            <PlayerName name={entry.name} userId={entry.userId} />
          </ProfileTrigger>
          {praise?.verdict === "crowned" ? (
            <CrownIcon className="size-3.5 shrink-0 text-[var(--color-gold)]" aria-label="Crowned by Salaxe" />
          ) : null}
          {praise ? (
            <span className="ml-auto shrink-0 text-xs font-semibold text-[var(--color-gold)] tabular-nums">+{formatNumber(praise.points)}</span>
          ) : null}
        </p>
        {praise ? (
          <p className="line-clamp-2 font-serif text-xs leading-relaxed text-foreground/80 italic">
            {"“"}
            {praise.body}
            {"”"}
          </p>
        ) : null}
      </div>
    </li>
  )
}

function KissersBody({ onSing }: { onSing: (() => void) | null }) {
  const query = useKissBoard("current")
  const { user } = useAuthUser()
  const viewerId = user?.id ?? null
  const data = query.data

  if (query.isPending) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Counting the kisses">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }
  if (!data?.available) {
    return <p className="text-xs text-muted-foreground">{data ? "The Hall of Kisses opens with the praise ledger." : "The kisses could not be counted right now."}</p>
  }

  const today = data.entries
    .filter((e) => e.today)
    .sort((x, y) => (y.recent[0]?.createdAt ?? "").localeCompare(x.recent[0]?.createdAt ?? ""))
  const top = data.entries.filter((e) => e.points > 0).slice(0, 3)

  return (
    <div className="space-y-4">
      <div className="space-y-2.5">
        <p className={LABEL}>Kissed today</p>
        {today.length > 0 ? (
          <ul className="space-y-2.5">
            {today.map((entry) => (
              <TodayRow key={entry.userId} entry={entry} mine={entry.userId === viewerId} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">The royal hand is still dry today.</p>
        )}
        {onSing ? (
          <Button variant="royal" className="h-10 w-full" onClick={onSing}>
            <HandHeartIcon aria-hidden />
            Kiss the hand
          </Button>
        ) : null}
      </div>

      {top.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-3">
          <p className={LABEL}>Most devoted · {seasonShort(data.season)}</p>
          <ol className="space-y-1.5">
            {top.map((entry) => (
              <li key={entry.userId} className="flex min-w-0 items-center gap-2 text-sm">
                <span className="w-4 shrink-0 text-center font-display font-semibold text-[var(--color-gold-light)]/80 tabular-nums">{entry.rank}</span>
                <ProfileTrigger playerId={entry.playerId} name={entry.name} className="min-w-0 text-[var(--color-gold-light)]">
                  <PlayerName name={entry.name} userId={entry.userId} />
                </ProfileTrigger>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                  {entry.kisses} · <span className="font-semibold text-[var(--color-gold)]">{formatNumber(entry.points)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <Link
        href={KISS_BOARD_HREF}
        className="flex h-10 items-center justify-between rounded-lg border border-[var(--color-gold)]/25 px-3 text-sm font-medium text-[var(--color-gold-light)] transition-colors outline-none hover:bg-[var(--color-gold)]/10 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        The Hall of Kisses
        <ArrowRightIcon className="size-4" aria-hidden />
      </Link>
    </div>
  )
}

function Title({ count }: { count: number | null }) {
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <HandHeartIcon className="size-4 shrink-0 text-[var(--color-gold)]" aria-hidden />
      <span className="font-display text-base tracking-wide text-[var(--color-gold)]">Hand kissers</span>
      {count !== null && count > 0 ? (
        <span className="rounded-full bg-[var(--color-gold)]/15 px-1.5 text-[11px] font-semibold text-[var(--color-gold)] tabular-nums">
          {count} today
        </span>
      ) : null}
    </span>
  )
}

function Panel() {
  const wide = useMediaQuery("(min-width: 1280px)")
  const { user } = useAuthUser()
  const userId = user?.id ?? null
  const praise = usePraiseState(userId, !!userId)
  const state = praise.data?.state
  const canSing = !!state?.available && !!state.me?.canSing
  const today = useKissBoard("current").data?.totals.today ?? null
  const [composer, setComposer] = useState<{ seed: number; open: boolean } | null>(null)
  const onSing = canSing ? () => setComposer({ seed: Math.floor(Math.random() * 1_000_000), open: true }) : null

  const shell = "rounded-xl border border-[var(--color-gold)]/20 bg-card"
  return (
    <>
      {wide ? (
        <section aria-labelledby="hand-kissers-title" className={cn(shell, "space-y-3 p-4")}>
          <h2 id="hand-kissers-title" className="flex items-center gap-1.5">
            <Title count={today} />
            <InfoTip help={KISS_BOARD_HELP.panel} align="end" />
          </h2>
          <KissersBody onSing={onSing} />
        </section>
      ) : (
        <Collapsible className={shell}>
          <div className="flex items-center gap-1 pr-2">
            <CollapsibleTrigger className="group/kissers flex min-h-12 min-w-0 flex-1 items-center gap-2 rounded-xl px-4 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Title count={today} />
              <ChevronDownIcon
                className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]/kissers:rotate-180"
                aria-hidden
              />
            </CollapsibleTrigger>
            <InfoTip help={KISS_BOARD_HELP.panel} align="end" />
          </div>
          <CollapsibleContent className="px-4 pb-4">
            <KissersBody onSing={onSing} />
          </CollapsibleContent>
        </Collapsible>
      )}
      {composer && (
        <ComposerDialog
          key={composer.seed}
          open={composer.open}
          onOpenChange={(open) => setComposer((current) => (current ? { ...current, open } : current))}
          seed={composer.seed}
          userId={userId}
          onOpenHall={() => setComposer(null)}
        />
      )}
    </>
  )
}

// Who kissed the hand today, beside the game: a card in the court column, a folded card on phones.
export function HandKissers() {
  return useContext(ShownAbove) ? null : <Panel />
}
