"use client"

import type { ReactNode } from "react"
import { XIcon, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useMediaQuery } from "@/components/session/use-browser-state"
import type { HelpEntry } from "@/lib/help"
import { cn } from "@/lib/utils"

interface CourtSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  icon: LucideIcon
  title: string
  description: string
  tone: "danger" | "roast"
  help?: HelpEntry
  footer?: ReactNode
  children: ReactNode
}

// Bottom sheet on phones, side panel from 640px up.
export function CourtSheet({ open, onOpenChange, icon: Icon, title, description, tone, help, footer, children }: CourtSheetProps) {
  const wide = useMediaQuery("(min-width: 640px)")
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={wide ? "right" : "bottom"}
        showCloseButton={false}
        className={cn(
          "gap-0 border-[var(--color-gold)]/25 bg-[var(--color-navy-light)] p-0",
          wide ? "w-full data-[side=right]:sm:max-w-md" : "max-h-[88dvh] rounded-t-2xl"
        )}
      >
        {!wide && <div aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted" />}
        <SheetClose
          render={<Button variant="ghost" size="icon" className="absolute top-2 right-2 z-10 size-10" />}
        >
          <XIcon aria-hidden />
          <span className="sr-only">Close</span>
        </SheetClose>
        <SheetHeader className="border-b border-border px-4 pt-4 pb-3 pr-14">
          <div className="flex items-center gap-2">
            <SheetTitle className="flex items-center gap-2 font-display text-lg font-semibold uppercase tracking-[0.14em] text-[var(--color-gold)]">
              <Icon className={cn("size-5", tone === "danger" ? "text-[var(--color-red-team)]" : "text-[var(--color-gold)]")} aria-hidden />
              {title}
            </SheetTitle>
            {help && <InfoTip help={help} side="bottom" align="start" />}
          </div>
          <SheetDescription className="text-xs leading-relaxed">{description}</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
        {footer && <SheetFooter className="border-t border-border bg-card/70 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  )
}
