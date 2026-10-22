"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { CrownIcon, GavelIcon, RefreshCwIcon, ScrollTextIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AnimatedNumber } from "@/components/praise/animated-number"
import { JudgeControls } from "@/components/praise/judge-controls"
import { PraiseCard } from "@/components/praise/praise-card"
import { useNow } from "@/components/praise/use-now"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import { effectsOfEquipped } from "@/hooks/use-title-effects"
import { effectNotes, favorReward, noteText } from "@/lib/titles/effects"
import type { EquippedTitle } from "@/lib/titles/types"
import { useJudgePraise, usePraiseHall } from "@/hooks/use-praise"
import { COURT_WINDOW_DAYS } from "@/lib/praise/rules"
import type { HallView, PraiseStateReady, PraiseVerdict, PraiseView } from "@/lib/praise/types"
import { COPY } from "@/lib/praise/voice"

const PAGE_SIZE = 30
const MAX_LIMIT = 150

const EMPTY_COPY: Record<HallView, string> = {
  latest: COPY.emptyLatest,
  crowned: COPY.emptyCrowned,
  mine: COPY.emptyMine,
  court: COPY.emptyCourt,
}

interface HallListProps {
  view: HallView
  state: PraiseStateReady
  userId: string | null
}

// A crown pays the author's Royal Favor, boosted by their own titles (Throne Polisher).
function authorFavor(entry: EquippedTitle | undefined): { favor: number; favorNote: string | null } {
  const fx = effectsOfEquipped(entry)
  const notes = effectNotes(fx, "favor_bonus_pct")
  return { favor: favorReward(fx), favorNote: notes.length ? notes.map(noteText).join(" · ") : null }
}

export function HallList({ view, state, userId }: HallListProps) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const hall = usePraiseHall(view, limit, userId)
  const judge = useJudgePraise(userId)
  const { byUserId } = useEquippedTitles()
  const now = useNow(60_000)
  const me = state.me

  const handleJudge = async (praise: PraiseView, verdict: PraiseVerdict, note: string) => {
    try {
      const expected = authorFavor(byUserId.get(praise.author.userId)).favor
      const result = await judge.mutateAsync({ id: praise.id, verdict, note, favor: expected })
      const favor = result.praise.favor || expected
      if (verdict === "crowned") toast.success(`Crowned. ${praise.author.name} receives +${favor} Royal Favor.`)
      else toast(`Scorned. ${praise.author.name} will remember this.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : COPY.errorTitle)
    }
  }

  if (hall.isPending) {
    return (
      <div className="space-y-3" aria-busy="true">
        {[0, 1, 2].map((key) => (
          <div key={key} className="space-y-2 rounded-xl border border-border p-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
    )
  }

  if (!hall.data) {
    return (
      <div role="alert" className="space-y-3 rounded-xl border border-destructive/30 p-4 text-sm">
        <p>{COPY.errorTitle}</p>
        <Button variant="outline" className="h-10 w-full" onClick={() => hall.refetch()}>
          <RefreshCwIcon aria-hidden />
          {COPY.retry}
        </Button>
      </div>
    )
  }

  const praises = hall.data.praises

  return (
    <div className="space-y-3">
      {view === "mine" && me && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Songs" value={me.total} />
          <Stat label="Crowned" value={me.crowned} />
          <Stat label="Favor" value={me.favor} prefix="+" />
        </div>
      )}
      {view === "mine" && me && me.legacy > 0 && (
        <p className="text-[11px] text-muted-foreground">{COPY.legacy(me.legacy)}</p>
      )}
      {view === "court" && state.court && (
        <p className="flex items-center gap-2 rounded-lg border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/5 px-3 py-2 text-xs text-muted-foreground">
          <GavelIcon className="size-4 shrink-0 text-[var(--color-gold)]" aria-hidden />
          <span>
            <span className="font-semibold text-foreground">
              {state.court.crownsLeft}/{state.court.crownLimit}
            </span>{" "}
            crowns left today. Verdicts are final and public. Songs leave the court after {COURT_WINDOW_DAYS} days.
          </span>
        </p>
      )}

      {praises.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
          {view === "crowned" ? (
            <CrownIcon className="size-6 text-[var(--color-gold)]/60" aria-hidden />
          ) : (
            <ScrollTextIcon className="size-6 text-[var(--color-gold)]/60" aria-hidden />
          )}
          <p className="max-w-64 text-sm text-muted-foreground">{EMPTY_COPY[view]}</p>
        </div>
      ) : (
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {praises.map((praise) => {
              const canJudge = !!me?.isSalaxe && !praise.verdict && praise.author.userId !== me.userId
              return (
                <motion.li
                  key={praise.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.2 }}
                >
                  <PraiseCard
                    praise={praise}
                    now={now}
                    salaxeUserId={state.salaxeUserId}
                    isMine={praise.author.userId === me?.userId}
                    title={byUserId.get(praise.author.userId)?.title ?? null}
                  >
                    {canJudge && state.court && (
                      <JudgeControls
                        authorName={praise.author.name}
                        crownsLeft={state.court.crownsLeft}
                        pending={judge.isPending && judge.variables?.id === praise.id}
                        {...authorFavor(byUserId.get(praise.author.userId))}
                        onJudge={(verdict, note) => void handleJudge(praise, verdict, note)}
                      />
                    )}
                  </PraiseCard>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ul>
      )}

      {hall.data.hasMore && limit < MAX_LIMIT && (
        <Button
          variant="outline"
          className="h-10 w-full"
          disabled={hall.isFetching}
          onClick={() => setLimit((current) => Math.min(MAX_LIMIT, current + PAGE_SIZE))}
        >
          {hall.isFetching ? "Unrolling older scrolls..." : "Show older songs"}
        </Button>
      )}
    </div>
  )
}

function Stat({ label, value, prefix = "" }: { label: string; value: number; prefix?: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 px-2 py-2">
      <AnimatedNumber
        value={value}
        prefix={prefix}
        className="block font-display text-lg font-semibold text-[var(--color-gold)]"
      />
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
    </div>
  )
}
