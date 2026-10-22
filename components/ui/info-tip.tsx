"use client"

import type { ReactNode } from "react"
import { CoinsIcon, InfoIcon, ScaleIcon, TrophyIcon } from "lucide-react"
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import type { HelpEntry } from "@/lib/help"
import { cn } from "@/lib/utils"

interface InfoTipProps {
  help: HelpEntry
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
  className?: string
  children?: ReactNode
}

function Row({ icon, label, children, tone }: { icon: ReactNode; label: string; children: ReactNode; tone?: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className={cn("mt-0.5 shrink-0", tone)} aria-hidden>
        {icon}
      </span>
      <p className="min-w-0 text-xs leading-relaxed">
        <span className="font-semibold text-foreground">{label}: </span>
        <span className="text-muted-foreground">{children}</span>
      </p>
    </div>
  )
}

export function HelpRows({ help }: { help: HelpEntry }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Row icon={<CoinsIcon className="size-3.5" />} label="Costs" tone="text-[var(--color-gold)]">
        {help.cost}
      </Row>
      {help.reward && (
        <Row icon={<TrophyIcon className="size-3.5" />} label="Pays" tone="text-emerald-400">
          {help.reward}
        </Row>
      )}
      {help.limits && (
        <Row icon={<ScaleIcon className="size-3.5" />} label="Rules" tone="text-muted-foreground">
          {help.limits}
        </Row>
      )}
    </div>
  )
}

// A small "i" bubble: opens on hover with a mouse, on tap on phones. Safe inside clickable cards: it renders a
// span and never lets its clicks reach the parent.
export function InfoTip({ help, side = "top", align = "center", className, children }: InfoTipProps) {
  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={120}
        nativeButton={false}
        aria-label={`What is ${help.title}?`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        render={
          <span
            className={cn(
              "relative inline-flex size-5 shrink-0 cursor-help items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:text-[var(--color-gold-light)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60 data-[popup-open]:text-[var(--color-gold)] before:absolute before:-inset-2.5 before:content-['']",
              className
            )}
          />
        }
      >
        {children ?? <InfoIcon className="size-4" aria-hidden />}
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-80 gap-2" onClick={(e) => e.stopPropagation()}>
        <PopoverTitle className="font-display text-sm">{help.title}</PopoverTitle>
        <PopoverDescription className="text-xs leading-relaxed">{help.does}</PopoverDescription>
        <HelpRows help={help} />
      </PopoverContent>
    </Popover>
  )
}
