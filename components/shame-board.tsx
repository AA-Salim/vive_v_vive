"use client"

import { useState } from "react"
import { AnimatePresence } from "motion/react"
import { ChevronRightIcon, MegaphoneIcon, RotateCcwIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { ShameDialog } from "@/components/shame-dialog"
import { isMigrationPending } from "@/components/bounties/request"
import { formatTimeLeft, useMsLeft } from "@/components/bounties/time-left"
import { PilloryCard } from "@/components/shame/pillory-card"
import { PillorySheet } from "@/components/shame/pillory-sheet"
import { useEgg, usePilloryWall } from "@/components/shame/use-pillory"
import { useAuth } from "@/hooks/use-auth"
import { PILLORY_COPY } from "@/lib/bounties/copy"
import { PILLORY_HELP } from "@/lib/bounties/help"
import { PILLORY_RULES } from "@/lib/bounties/rules"
import type { PilloryEntryView } from "@/lib/bounties/types"

interface ShameBoardProps {
  userId: string | null
}

const PREVIEW = 2

export function ShameBoard({ userId }: ShameBoardProps) {
  const { signIn } = useAuth()
  const wall = usePilloryWall(userId)
  const egg = useEgg(userId)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const cooldown = useMsLeft(wall.data?.viewer.nextPostAt ?? null)

  const data = wall.data
  const entries = data?.entries ?? []
  const available = data?.available ?? false
  const signedIn = !!userId
  const coolingDown = cooldown !== null && cooldown > 0
  const showPost = !signedIn || available

  const openDialog = () => {
    if (!signedIn) {
      signIn()
      return
    }
    setDialogOpen(true)
  }

  const throwEgg = (entry: PilloryEntryView) => {
    if (!signedIn) {
      signIn()
      return
    }
    egg.mutate(entry.id, {
      onSuccess: (result) =>
        toast.success(`Splat. ${entry.target.name} takes an egg.`, {
          description: result.extended ? "One more hour on the wall." : "The wall is at its limit, but it still stings.",
        }),
      onError: (error) => toast.error(isMigrationPending(error) ? PILLORY_COPY.pending : error.message),
    })
  }

  const dialogNode = <ShameDialog open={dialogOpen} onOpenChange={setDialogOpen} />

  return (
    <section aria-labelledby="pillory-title" className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
      <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-gold)]/60 to-transparent" />
      <header className="flex items-center gap-2">
        <MegaphoneIcon className="size-4 text-[var(--color-gold)]" aria-hidden />
        <h2 id="pillory-title" className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]">
          {PILLORY_COPY.title}
        </h2>
        <InfoTip help={PILLORY_HELP.wall} />
        {entries.length > 0 && (
          <span className="ml-auto rounded-full bg-[var(--color-gold)]/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--color-gold)]">
            {entries.length} on the wall
          </span>
        )}
      </header>
      <p className="mt-1 text-xs text-muted-foreground">{PILLORY_COPY.tagline}</p>

      {wall.isPending ? (
        <div className="mt-3 space-y-2" aria-busy="true" aria-label="Loading the pillory">
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : wall.isError && !data ? (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground" role="alert">
          {PILLORY_COPY.error}
          <Button variant="outline" className="h-10 shrink-0" onClick={() => wall.refetch()}>
            <RotateCcwIcon aria-hidden />
            Retry
          </Button>
        </div>
      ) : entries.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-[var(--color-gold)]/25 px-3 py-4 text-center text-xs text-muted-foreground">
          {data?.available === false ? PILLORY_COPY.pending : PILLORY_COPY.empty}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <AnimatePresence initial={false}>
            {entries.slice(0, PREVIEW).map((entry) => (
              <PilloryCard
                key={entry.id}
                entry={entry}
                compact
                viewerPlayerId={data?.viewer.playerId ?? null}
                signedIn={signedIn}
                canEgg={available}
                onEgg={throwEgg}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2.5">
        {showPost && (
          <>
            <Button
              onClick={openDialog}
              disabled={signedIn && coolingDown}
              className="h-10 min-w-0 flex-1 rounded-xl bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]"
            >
              <MegaphoneIcon aria-hidden />
              <span className="truncate">
                {signedIn && coolingDown ? `Ready in ${formatTimeLeft(cooldown ?? 0)}` : `Pillory · ${PILLORY_RULES.cost}`}
              </span>
            </Button>
            <InfoTip help={PILLORY_HELP.post} />
          </>
        )}
        <Button variant="outline" className={showPost ? "h-10 shrink-0 rounded-xl px-3" : "h-10 flex-1 rounded-xl"} onClick={() => setSheetOpen(true)}>
          {entries.length > PREVIEW ? `${PILLORY_COPY.seeAll} (${entries.length})` : PILLORY_COPY.seeAll}
          <ChevronRightIcon aria-hidden />
        </Button>
      </div>

      <PillorySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        wall={data}
        isPending={wall.isPending}
        isError={wall.isError}
        onRetry={() => wall.refetch()}
        signedIn={signedIn}
        onSignIn={signIn}
        onPost={openDialog}
        onEgg={throwEgg}
        nested={sheetOpen ? dialogNode : null}
      />
      {!sheetOpen && dialogNode}
    </section>
  )
}
