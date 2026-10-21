"use client"

import { useState } from "react"
import { ArrowRight, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { TitleBadge } from "@/components/title-badge"
import { AnimatedNumber } from "@/components/titles/animated-number"
import { PerkLine } from "@/components/titles/perk-line"
import { cn } from "@/lib/utils"
import type { TitleView } from "@/lib/titles/types"

interface BuyDialogProps {
  title: TitleView | null
  balance: number | null
  locked: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (title: TitleView, equip: boolean) => void
}

export function BuyDialog({ title, balance, locked, pending, onOpenChange, onConfirm }: BuyDialogProps) {
  const [equip, setEquip] = useState(true)
  const after = balance === null || !title ? null : balance - title.price

  return (
    <Dialog open={!!title} onOpenChange={onOpenChange}>
      <DialogContent className="border border-[var(--color-gold)]/25 bg-[var(--color-navy-light)] sm:max-w-md">
        {title && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-[var(--color-gold)]">Claim this title?</DialogTitle>
              <DialogDescription>The Crown accepts points, not apologies. No refunds, only regrets.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-xl border border-border bg-[var(--color-navy)]/70 p-4">
              <TitleBadge name={title.name} category={title.category} rarity={title.rarity} perk={title.perk} size="lg" interactive={false} />
              <p className="text-xs text-muted-foreground italic">&ldquo;{title.description}&rdquo;</p>
              <PerkLine perk={title.perk} className="text-sm" />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Coins aria-hidden className="size-4 text-[var(--color-gold)]" />
                Price <span className="font-semibold text-[var(--color-gold-light)] tabular-nums">{title.price}</span>
              </span>
              {balance !== null && after !== null && (
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <span className="text-muted-foreground">{balance}</span>
                  <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
                  <AnimatedNumber value={after} className={cn("font-semibold", after < 0 ? "text-rose-300" : "text-[var(--color-gold-light)]")} />
                </span>
              )}
            </div>
            {after !== null && after < 0 && (
              <p className="text-xs text-rose-300">
                {balance !== null && balance < 0
                  ? "You are already in debt. The Crown will want a pledge of allegiance first."
                  : "This sinks you into debt. Your next purchase will need a pledge of allegiance."}
              </p>
            )}

            <Label className="min-h-10 cursor-pointer gap-3 rounded-lg px-1 text-sm font-normal text-[var(--color-gold-light)]/90">
              <Checkbox checked={equip && !locked} disabled={locked} onCheckedChange={(checked) => setEquip(checked)} />
              {locked ? "Equip after the game: titles are sealed while it is live" : "Raise it as my banner right away"}
            </Label>

            <DialogFooter className="bg-transparent">
              <Button variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
                Not today
              </Button>
              <Button className="h-10 gap-1.5" disabled={pending} onClick={() => onConfirm(title, equip && !locked)}>
                <Coins aria-hidden />
                {pending ? "Engraving..." : `Buy for ${title.price}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
