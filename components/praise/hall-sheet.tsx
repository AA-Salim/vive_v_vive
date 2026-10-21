"use client"

import { LibraryIcon } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HallList } from "@/components/praise/hall-list"
import { HALL_VIEWS, type HallView, type PraiseStateReady } from "@/lib/praise/types"
import { COPY } from "@/lib/praise/voice"

interface HallSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  view: HallView
  onViewChange: (view: HallView) => void
  state: PraiseStateReady
  userId: string | null
}

const LABELS: Record<HallView, string> = {
  latest: "Latest",
  crowned: "Crowned",
  mine: "Mine",
  court: "Court",
}

export function HallSheet({ open, onOpenChange, view, onViewChange, state, userId }: HallSheetProps) {
  const views = HALL_VIEWS.filter((v) => (v === "mine" ? !!state.me : v === "court" ? !!state.court : true))
  const active = views.includes(view) ? view : "latest"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
        <SheetHeader className="border-b border-border pr-12">
          <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]/80">
            <LibraryIcon className="size-3.5" aria-hidden />
            The royal archive
          </p>
          <SheetTitle className="font-display text-xl text-[var(--color-gold)]">{COPY.hallTitle}</SheetTitle>
          <SheetDescription className="text-xs">
            {state.totalCount > 0
              ? `${state.totalCount} ${state.totalCount === 1 ? "song" : "songs"} sung so far. He has read them all. Twice.`
              : COPY.hallDescription}
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={active}
          onValueChange={(value) => onViewChange(value as HallView)}
          className="min-h-0 flex-1 gap-0"
        >
          <TabsList className="mx-4 mt-3 w-auto shrink-0 group-data-horizontal/tabs:h-12 sm:group-data-horizontal/tabs:h-10">
            {views.map((v) => (
              <TabsTrigger key={v} value={v} className="h-full px-2 text-[13px]">
                {LABELS[v]}
                {v === "court" && state.court && state.court.pending > 0 && (
                  <span className="rounded-full bg-[var(--color-gold)] px-1.5 text-[10px] font-bold leading-4 text-[var(--color-navy)]">
                    {state.court.pending}
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {views.map((v) => (
            <TabsContent key={v} value={v} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-8">
              <HallList view={v} state={state} userId={userId} />
            </TabsContent>
          ))}
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
