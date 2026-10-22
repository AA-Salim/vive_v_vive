"use client"

import { useState } from "react"
import { AnimatePresence } from "motion/react"
import { ChevronRightIcon, CrosshairIcon, PlusIcon, RotateCcwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { BountyDialog } from "@/components/bounty-dialog"
import { BountySheet, liveFirst } from "@/components/bounties/bounty-sheet"
import { LastHunt } from "@/components/bounties/hunt-history"
import { useOnTheRift } from "@/components/bounties/use-wanted"
import { WarrantRow } from "@/components/bounties/warrant-row"
import { useBountyBoard } from "@/components/bounties/use-bounties"
import { useAuth } from "@/hooks/use-auth"
import { WARRANT_COPY } from "@/lib/bounties/copy"
import { WARRANT_HELP } from "@/lib/bounties/help"
import type { WarrantView } from "@/lib/bounties/types"

const PREVIEW = 3

export function BountyPanel() {
  const { user, signIn } = useAuth()
  const userId = user?.id ?? null
  const board = useBountyBoard(userId)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [focusId, setFocusId] = useState<string | null>(null)
  const [dialog, setDialog] = useState<{ open: boolean; targetId: string | null }>({ open: false, targetId: null })

  const onTheRift = useOnTheRift()
  const data = board.data
  const warrants = liveFirst(data?.warrants ?? [], onTheRift)
  const canPledge = !!userId && (data?.available ?? false)
  const showPost = canPledge || !userId
  const myPlayerId = data?.viewer.playerId ?? null

  const openSheet = (warrant: WarrantView | null) => {
    setFocusId(warrant?.id ?? null)
    setSheetOpen(true)
  }
  const openDialog = (warrant: WarrantView | null) => {
    if (!userId) {
      signIn()
      return
    }
    setDialog({ open: true, targetId: warrant?.target.playerId ?? null })
  }

  const dialogNode = (
    <BountyDialog
      open={dialog.open}
      onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      initialTargetId={dialog.targetId}
    />
  )

  return (
    <section aria-labelledby="warrants-title" className="relative overflow-hidden rounded-xl border border-border bg-card p-4">
      <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-red-team)]/60 to-transparent" />
      <header className="flex items-center gap-2">
        <CrosshairIcon className="size-4 text-[var(--color-red-team)]" aria-hidden />
        <h2 id="warrants-title" className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]">
          {WARRANT_COPY.title}
        </h2>
        <InfoTip help={WARRANT_HELP.board} />
        {warrants.length > 0 && (
          <span className="ml-auto rounded-full bg-[var(--color-red-team)]/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--color-red-team)]">
            {warrants.length} open
          </span>
        )}
      </header>
      <p className="mt-1 text-xs text-muted-foreground">{WARRANT_COPY.tagline}</p>

      {board.isPending ? (
        <div className="mt-3 space-y-2" aria-busy="true" aria-label="Loading warrants">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : board.isError && !data ? (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground" role="alert">
          {WARRANT_COPY.error}
          <Button variant="outline" className="h-10 shrink-0" onClick={() => board.refetch()}>
            <RotateCcwIcon aria-hidden />
            Retry
          </Button>
        </div>
      ) : warrants.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-[var(--color-red-team)]/25 px-3 py-4 text-center text-xs text-muted-foreground">
          {data?.available === false ? WARRANT_COPY.pending : WARRANT_COPY.empty}
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          <AnimatePresence initial={false}>
            {warrants.slice(0, PREVIEW).map((warrant) => (
              <WarrantRow
                key={warrant.id}
                warrant={warrant}
                canPledge={canPledge}
                isMe={!!myPlayerId && warrant.target.playerId === myPlayerId}
                live={onTheRift.has(warrant.target.playerId)}
                onOpen={openSheet}
                onPledge={openDialog}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}

      <LastHunt record={data?.recent[0]} />

      <div className="mt-3 flex items-center gap-2.5">
        {showPost && (
          <>
            <Button
              onClick={() => openDialog(null)}
              className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--color-red-team)]/40 bg-[var(--color-red-team)]/15 font-semibold text-[var(--color-gold-light)] hover:bg-[var(--color-red-team)]/25"
            >
              <PlusIcon aria-hidden />
              <span className="truncate">{WARRANT_COPY.post}</span>
            </Button>
            <InfoTip help={WARRANT_HELP.pledge} />
          </>
        )}
        <Button variant="outline" className={showPost ? "h-10 shrink-0 rounded-xl px-3" : "h-10 flex-1 rounded-xl"} onClick={() => openSheet(null)}>
          {warrants.length > PREVIEW ? `All ${warrants.length}` : WARRANT_COPY.seeAll}
          <ChevronRightIcon aria-hidden />
        </Button>
      </div>

      <BountySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        board={data}
        isPending={board.isPending}
        isError={board.isError}
        onRetry={() => board.refetch()}
        focusId={focusId}
        signedIn={!!userId}
        onSignIn={signIn}
        onPledge={openDialog}
        nested={sheetOpen ? dialogNode : null}
      />
      {!sheetOpen && dialogNode}
    </section>
  )
}
