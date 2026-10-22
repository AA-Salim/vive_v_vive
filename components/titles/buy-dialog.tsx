"use client"

import { useState } from "react"
import { ArrowRight, Coins } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { HelpRows, InfoTip } from "@/components/ui/info-tip"
import { Label } from "@/components/ui/label"
import { TitleBadge } from "@/components/title-badge"
import { AnimatedNumber } from "@/components/titles/animated-number"
import { EffectBox, EffectLines } from "@/components/titles/effect-lines"
import { PerkLine } from "@/components/titles/perk-line"
import { TierChip } from "@/components/titles/tier-chip"
import { cn } from "@/lib/utils"
import { gamesLabel } from "@/lib/titles/expiry"
import { titleHelp } from "@/lib/titles/help"
import { SLOT_LABEL } from "@/lib/titles/loadout"
import { HAND_KISS_NOTE, formatPrice, multiplierLabel } from "@/lib/titles/pricing"
import type { TitleView } from "@/lib/titles/types"

interface BuyDialogProps {
  title: TitleView | null
  balance: number | null
  locked: boolean
  // Why the title could not join the loadout right after buying, or null.
  equipBlock: string | null
  pending: boolean
  // The title is owned but out of games: buying it again restarts its run.
  renewing?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (title: TitleView, equip: boolean) => void
}

export function BuyDialog({ title, balance, locked, equipBlock, pending, renewing = false, onOpenChange, onConfirm }: BuyDialogProps) {
  const [equip, setEquip] = useState(true)
  const after = balance === null || !title ? null : balance - title.price
  const canEquip = !locked && !equipBlock

  return (
    <Dialog open={!!title} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border border-[var(--color-gold)]/25 bg-[var(--color-navy-light)] sm:max-w-md">
        {title && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-[var(--color-gold)]">{renewing ? "Renew this title?" : "Claim this title?"}</DialogTitle>
              <DialogDescription>The Crown accepts points, not apologies. No refunds, only regrets.</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-xl border border-border bg-[var(--color-navy)]/70 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <TitleBadge name={title.name} category={title.category} rarity={title.rarity} perk={title.perk} size="lg" interactive={false} />
                <span className="flex items-center gap-1">
                  <TierChip tier={title.tier} price={title.price} />
                  <InfoTip help={titleHelp(title)} align="end" />
                </span>
              </div>
              <p className="text-xs text-muted-foreground italic">&ldquo;{title.description}&rdquo;</p>
              <EffectBox label="While equipped, the moment you act">
                <EffectLines effects={title.effects} className="text-sm" />
              </EffectBox>
              <EffectBox label="After each game">
                <PerkLine perk={title.perk} className="text-sm" />
              </EffectBox>
              <p className="text-[11px] text-muted-foreground">
                Takes a {SLOT_LABEL[title.slot]} slot in your loadout.
                {typeof title.games === "number" &&
                  ` Good for ${gamesLabel(title.games)} you take part in while wearing it, then renew it at the same price.`}
              </p>
              <div className="border-t border-border/60 pt-2.5">
                <HelpRows help={titleHelp({ name: title.name, category: title.category, perk: title.perk, price: title.price, tier: title.tier })} />
              </div>
            </div>

            <div className="space-y-1 rounded-lg border border-border px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <Coins aria-hidden className="size-4 text-[var(--color-gold)]" />
                  Price{" "}
                  <span className="font-semibold text-[var(--color-gold-light)] tabular-nums">{formatPrice(title.price)}</span>
                </span>
                {balance !== null && after !== null && (
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <span className="text-muted-foreground">{formatPrice(balance)}</span>
                    <ArrowRight aria-hidden className="size-3.5 text-muted-foreground" />
                    <AnimatedNumber value={after} className={cn("font-semibold", after < 0 ? "text-rose-300" : "text-[var(--color-gold-light)]")} />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {multiplierLabel(title.tier)}. {HAND_KISS_NOTE}
              </p>
            </div>
            {after !== null && after < 0 && (
              <p className="text-xs text-rose-300">
                {balance !== null && balance < 0
                  ? "You are already in debt. The Crown will want a pledge of allegiance first."
                  : "This sinks you into debt. Your next purchase will need a pledge of allegiance."}
              </p>
            )}

            <div className="space-y-1">
              <Label className="min-h-10 cursor-pointer gap-3 rounded-lg px-1 text-sm font-normal text-[var(--color-gold-light)]/90">
                <Checkbox checked={equip && canEquip} disabled={!canEquip} onCheckedChange={(checked) => setEquip(checked)} />
                {locked ? "Equip after the game: titles are sealed while it is live" : "Equip it right away"}
              </Label>
              {!locked && equipBlock && <p className="px-1 text-[11px] leading-snug text-amber-200/80">{equipBlock} It lands in your collection.</p>}
            </div>

            <DialogFooter className="bg-transparent">
              <Button variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
                Not today
              </Button>
              <Button className="h-10 gap-1.5" disabled={pending} onClick={() => onConfirm(title, equip && canEquip)}>
                <Coins aria-hidden />
                {pending ? "Engraving..." : `${renewing ? "Renew" : "Buy"} for ${formatPrice(title.price)}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
