"use client"

import { Banknote, Crown, Flame, Lock, ScrollText, Skull, Swords } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { EXPLAINER } from "@/lib/titles/copy"

const ICONS = [Crown, Banknote, Swords, Skull, Flame, Lock]

export function PerksExplainer() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" className="h-10 gap-2 px-3" />}>
        <ScrollText aria-hidden />
        How titles work
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto border border-border bg-[var(--color-navy-light)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-xl text-[var(--color-gold)]">The Royal Rulebook</DialogTitle>
          <DialogDescription>Read it once. Salaxe never did.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-3">
          {EXPLAINER.map((rule, index) => {
            const Icon = ICONS[index % ICONS.length]
            return (
              <li key={rule.title} className="flex gap-3 rounded-lg border border-border/60 bg-[var(--color-navy)]/60 p-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10 text-[var(--color-gold)]">
                  <Icon aria-hidden className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-display text-sm text-[var(--color-gold-light)]">{rule.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{rule.body}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </DialogContent>
    </Dialog>
  )
}
