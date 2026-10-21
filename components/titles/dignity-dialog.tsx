"use client"

import { Flame } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { TitleBadge } from "@/components/title-badge"
import { PerkLine } from "@/components/titles/perk-line"
import type { OwnedTitleView, TitleView } from "@/lib/titles/types"

interface DignityDialogProps {
  target: { title: TitleView; owned: OwnedTitleView } | null
  balance: number | null
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (title: TitleView) => void
}

export function DignityDialog({ target, balance, pending, onOpenChange, onConfirm }: DignityDialogProps) {
  const curse = target?.owned.curse
  const cost = curse?.dignity_cost ?? 0
  const bestower = target?.owned.bestowed_by?.name ?? "a mystery noble"
  const cantAfford = balance !== null && balance - cost < -300

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="border border-rose-500/30 bg-[var(--color-navy-light)] sm:max-w-md">
        {target && curse && (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-xl text-rose-200">Buy back your dignity</DialogTitle>
              <DialogDescription>
                {bestower} branded you {curse.served === 0 ? "recently" : `${curse.served} game${curse.served === 1 ? "" : "s"} ago`}.
                Pay the Crown and the brand burns away for good.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-3">
              <TitleBadge name={target.title.name} category={target.title.category} rarity="cursed" size="md" interactive={false} />
              <PerkLine perk={target.owned.perk} />
              <p className="text-[11px] text-rose-200/80">
                {curse.left} game{curse.left === 1 ? "" : "s"} left on the clock if you do nothing.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {bestower} keeps the {target.title.price} they spent. Their tribute stops the moment the brand burns.
            </p>
            <DialogFooter className="bg-transparent">
              <Button variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
                Keep the shame
              </Button>
              <Button
                variant="destructive"
                className="h-10 gap-1.5"
                disabled={pending || cantAfford}
                onClick={() => onConfirm(target.title)}
              >
                <Flame aria-hidden />
                {pending ? "Burning..." : cantAfford ? "Too poor for dignity" : `Burn it for ${cost}`}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
