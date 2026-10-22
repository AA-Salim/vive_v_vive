"use client"

import { ChevronDownIcon, ScaleIcon } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export function RulesList({ title, rules, defaultOpen = false }: { title: string; rules: string[]; defaultOpen?: boolean }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="rounded-xl border border-border bg-card/60">
      <CollapsibleTrigger className="group/rules flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-gold-light)]/85 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ScaleIcon className="size-4 text-[var(--color-gold)]" aria-hidden />
        <span className="flex-1">{title}</span>
        <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[panel-open]/rules:rotate-180" aria-hidden />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="space-y-1.5 px-3 pb-3 text-xs leading-relaxed text-muted-foreground">
          {rules.map((rule, i) => (
            <li key={rule} className="flex gap-2">
              <span className="font-display font-semibold text-[var(--color-gold)]">{i + 1}.</span>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  )
}
