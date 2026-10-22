"use client"

import { Banknote, Coins, Crown, Flame, Hourglass, Layers, Lock, ScrollText, Skull, Zap, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { explainer, type ExplainerIcon } from "@/lib/titles/copy"

const ICONS: Record<ExplainerIcon, LucideIcon> = {
  loadout: Crown,
  expiry: Hourglass,
  effects: Zap,
  sets: Layers,
  perks: Banknote,
  price: Coins,
  curses: Skull,
  dignity: Flame,
  sealed: Lock,
}

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
          {explainer().map((rule) => {
            const Icon = ICONS[rule.icon]
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
