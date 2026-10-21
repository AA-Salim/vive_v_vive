"use client"

import { useRef, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { LOBBY_SIZE } from "@/lib/lobby/constants"

interface RosterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  search: ReactNode
  children: ReactNode
}

export function RosterSheet({ open, onOpenChange, count, search, children }: RosterSheetProps) {
  const listRef = useRef<HTMLDivElement>(null)
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        initialFocus={(type) => (type === "touch" ? listRef.current : true)}
        className="max-h-[88dvh] max-w-[100vw] gap-0 rounded-t-2xl border-[var(--color-gold)]/25 bg-card p-0"
        showCloseButton={false}
      >
        <SheetHeader className="gap-3 border-b border-border px-4 pt-3 pb-3">
          <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/40" />
          <div className="flex items-baseline justify-between gap-3">
            <SheetTitle className="font-display text-lg font-semibold text-[var(--color-gold)]">The full roster</SheetTitle>
            <SheetDescription className="text-xs tabular-nums">
              {count}/{LOBBY_SIZE} selected
            </SheetDescription>
          </div>
          {search}
        </SheetHeader>
        <div ref={listRef} tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 outline-none">
          {children}
        </div>
        <SheetFooter className="border-t border-border px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button className="h-12 w-full text-base font-semibold" onClick={() => onOpenChange(false)}>
            Done · {count}/{LOBBY_SIZE}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
