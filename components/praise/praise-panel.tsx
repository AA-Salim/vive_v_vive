"use client"

import { useCallback, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { MotionConfig } from "motion/react"
import { CrownIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ComposerDialog } from "@/components/praise/composer-dialog"
import { HallSheet } from "@/components/praise/hall-sheet"
import {
  CooldownSection,
  CourtSection,
  ErrorSection,
  FeaturedSection,
  LoggedOutSection,
  MigrationPendingSection,
  PanelSkeleton,
  ReadySection,
} from "@/components/praise/panel-sections"
import { useNow } from "@/components/praise/use-now"
import { praiseKeys, usePraiseAuth, usePraiseLiveToasts, usePraiseState } from "@/hooks/use-praise"
import type { HallView } from "@/lib/praise/types"
import { COPY, PANEL_KICKERS, seededPick } from "@/lib/praise/voice"

export function PraisePanel() {
  const queryClient = useQueryClient()
  const auth = usePraiseAuth()
  const stateQuery = usePraiseState(auth.userId, auth.ready)
  const now = useNow(60_000)
  const [hallOpen, setHallOpen] = useState(false)
  const [hallView, setHallView] = useState<HallView>("latest")
  const [composer, setComposer] = useState<{ seed: number; open: boolean } | null>(null)

  const data = stateQuery.data
  const state = data?.state.available ? data.state : null
  const me = state?.me ?? null

  const openHall = useCallback((view: HallView) => {
    setHallView(view)
    setHallOpen(true)
  }, [])

  usePraiseLiveToasts({ userId: auth.userId, isSalaxe: !!me?.isSalaxe, onJudge: () => openHall("court") })

  const refreshDay = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: praiseKeys.all })
  }, [queryClient])

  const loading = !auth.ready || stateQuery.isPending
  const kicker = state ? seededPick(PANEL_KICKERS, state.today) : PANEL_KICKERS[0]

  let body: ReactNode
  if (loading) {
    body = <PanelSkeleton />
  } else if (!data) {
    body = <ErrorSection onRetry={() => stateQuery.refetch()} />
  } else if (!state) {
    body = <MigrationPendingSection />
  } else {
    body = (
      <>
        {!me ? (
          <LoggedOutSection onLogin={auth.signIn} />
        ) : me.canSing ? (
          <ReadySection me={me} onCompose={() => setComposer({ seed: Math.floor(Math.random() * 1_000_000), open: true })} />
        ) : (
          <CooldownSection
            me={me}
            today={state.today}
            resetsAt={state.resetsAt}
            clockOffset={data.clockOffset}
            salaxeUserId={state.salaxeUserId}
            onElapsed={refreshDay}
          />
        )}
        {state.court && <CourtSection court={state.court} onHoldCourt={() => openHall("court")} />}
        <FeaturedSection
          featured={state.featured && state.featured.id !== me?.today?.id ? state.featured : null}
          totalCount={state.totalCount}
          now={now}
          onOpenHall={() => openHall("latest")}
        />
      </>
    )
  }

  return (
    <MotionConfig reducedMotion="user">
      <Card className="relative gap-3 ring-[var(--color-gold)]/25 before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[var(--color-gold)]/70 before:to-transparent">
        <CardHeader className="gap-1">
          <CardTitle>
            <h2 className="flex items-center gap-2 font-display text-base tracking-wide text-[var(--color-gold)]">
              <CrownIcon className="size-4 shrink-0" aria-hidden />
              {COPY.title}
            </h2>
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="border-[var(--color-gold)]/40 text-[var(--color-gold)]">
              {COPY.rewardBadge}
            </Badge>
          </CardAction>
          <CardDescription className="text-xs leading-relaxed">
            {loading ? <Skeleton className="mt-1 h-3 w-4/5" /> : kicker}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">{body}</CardContent>

        {state && (
          <HallSheet
            open={hallOpen}
            onOpenChange={setHallOpen}
            view={hallView}
            onViewChange={setHallView}
            state={state}
            userId={auth.userId}
          />
        )}
        {state && me && composer && (
          <ComposerDialog
            key={composer.seed}
            open={composer.open}
            onOpenChange={(open) => setComposer((current) => (current ? { ...current, open } : current))}
            seed={composer.seed}
            userId={auth.userId}
            onOpenHall={() => openHall("latest")}
          />
        )}
      </Card>
    </MotionConfig>
  )
}
