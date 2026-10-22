"use client"

import { Check, Coins, Skull, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { TitleBadge } from "@/components/title-badge"
import { PerkLine } from "@/components/titles/perk-line"
import { RARITY_FRAME, RARITY_TEXT } from "@/components/titles/title-visuals"
import { cn } from "@/lib/utils"
import { RARITY_LABEL } from "@/lib/titles/catalog"
import { titleHelp } from "@/lib/titles/help"
import { CURSE_GAMES } from "@/lib/titles/rules"
import type { OwnedTitleView, TitleView } from "@/lib/titles/types"

const DEBT_FLOOR = -300

interface TitleShopCardProps {
  title: TitleView
  owned: OwnedTitleView | undefined
  balance: number | null
  signedIn: boolean
  locked: boolean
  busy: boolean
  onBuy: (title: TitleView) => void
  onBestow: (title: TitleView) => void
  onEquip: (title: TitleView) => void
}

export function TitleShopCard({ title, owned, balance, signedIn, locked, busy, onBuy, onBestow, onEquip }: TitleShopCardProps) {
  const curse = !title.for_self
  const affordable = balance === null || balance - title.price >= DEBT_FLOOR
  const brandedOnMe = curse && !!owned?.curse?.active

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 transition-colors",
        RARITY_FRAME[title.rarity],
        "hover:bg-[var(--color-navy-lighter)]/60"
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          curse ? "via-rose-400/60" : title.rarity === "epic" ? "via-violet-300/60" : "via-[var(--color-gold)]/60"
        )}
      />
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <TitleBadge
            name={title.name}
            category={title.category}
            rarity={title.rarity}
            perk={title.perk}
            description={title.description}
            price={title.price}
            size="md"
            interactive
          />
          <p className={cn("text-[10px] font-semibold tracking-wider uppercase", RARITY_TEXT[title.rarity])}>
            {RARITY_LABEL[title.rarity]}
            {curse ? <span className="text-muted-foreground"> · bestowed on others</span> : null}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/10 px-2 py-1 text-xs font-bold text-[var(--color-gold)] tabular-nums">
          <Coins aria-hidden className="size-3.5" />
          {title.price}
        </span>
      </header>

      <p className="text-xs text-muted-foreground italic">&ldquo;{title.description}&rdquo;</p>

      <div
        className={cn(
          "rounded-lg border p-2.5",
          curse ? "border-rose-500/25 bg-rose-500/[0.06]" : "border-[var(--color-gold)]/15 bg-[var(--color-gold)]/[0.04]"
        )}
      >
        <p className={cn("mb-1 text-[10px] font-bold tracking-wider uppercase", curse ? "text-rose-300" : "text-[var(--color-gold)]/80")}>
          {curse ? `Curse · ${CURSE_GAMES} games` : "Perk"}
        </p>
        <PerkLine perk={title.perk} />
      </div>

      <footer className="mt-auto flex items-center justify-between gap-3 pt-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Users aria-hidden className="size-3.5" />
          {title.holders === 0
            ? curse
              ? "Nobody branded yet"
              : "Be the first"
            : curse
              ? `${title.holders} branded so far`
              : `${title.holders} own it${title.wearing > 0 ? `, ${title.wearing} wearing` : ""}`}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <InfoTip
            help={titleHelp({ name: title.name, category: title.category, perk: title.perk, price: title.price })}
            side="top"
            align="end"
          />
        {curse ? (
          <Button
            variant="destructive"
            className="h-10 gap-1.5 px-4"
            disabled={!signedIn || busy}
            onClick={() => onBestow(title)}
          >
            <Skull aria-hidden />
            Bestow
          </Button>
        ) : owned ? (
          owned.is_active ? (
            <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-200">
              <Check aria-hidden className="size-4" />
              Equipped
            </span>
          ) : (
            <Button variant="outline" className="h-10 px-4" disabled={locked || busy} onClick={() => onEquip(title)}>
              Equip
            </Button>
          )
        ) : (
          <Button className="h-10 px-4" disabled={!signedIn || !affordable || busy} onClick={() => onBuy(title)}>
            {affordable ? "Buy" : "Too poor"}
          </Button>
        )}
        </span>
      </footer>
      {brandedOnMe && (
        <p className="-mt-1 text-[11px] text-rose-300">This brand is currently burning on you.</p>
      )}
    </article>
  )
}
