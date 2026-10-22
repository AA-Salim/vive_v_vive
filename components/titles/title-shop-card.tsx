"use client"

import { Check, Flame, Hourglass, Layers, RotateCcw, Skull, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { TitleBadge } from "@/components/title-badge"
import { EffectBox, EffectLines } from "@/components/titles/effect-lines"
import { GamesLeftTag } from "@/components/titles/loadout-parts"
import { PerkLine } from "@/components/titles/perk-line"
import { TierChip } from "@/components/titles/tier-chip"
import { RARITY_FRAME, RARITY_TEXT } from "@/components/titles/title-visuals"
import { cn } from "@/lib/utils"
import { CATEGORY_META, RARITY_LABEL } from "@/lib/titles/catalog"
import { gamesLabel, isExpired } from "@/lib/titles/expiry"
import { setHelp, titleHelp } from "@/lib/titles/help"
import { SLOT_LABEL } from "@/lib/titles/loadout"
import { formatPrice } from "@/lib/titles/pricing"
import { CURSE_GAMES } from "@/lib/titles/rules"
import { progressLabel, titleSet, type SetProgress } from "@/lib/titles/sets"
import type { OwnedTitleView, TitleView } from "@/lib/titles/types"

const DEBT_FLOOR = -300

interface TitleShopCardProps {
  title: TitleView
  owned: OwnedTitleView | undefined
  balance: number | null
  signedIn: boolean
  locked: boolean
  busy: boolean
  worn: boolean
  // Why it cannot be equipped right now (slot full, conflict), or null.
  equipBlock: string | null
  // Where the current loadout stands in each set this title belongs to.
  sets?: SetProgress[]
  onBuy: (title: TitleView) => void
  onBestow: (title: TitleView) => void
  onEquip: (title: TitleView) => void
  onUnequip: (title: TitleView) => void
}

export function TitleShopCard({
  title,
  owned,
  balance,
  signedIn,
  locked,
  busy,
  worn,
  equipBlock,
  sets = [],
  onBuy,
  onBestow,
  onEquip,
  onUnequip,
}: TitleShopCardProps) {
  const curse = !title.for_self
  const expired = !curse && !!owned && isExpired(owned.games_left)
  const affordable = balance === null || balance - title.price >= DEBT_FLOOR
  const brandedOnMe = curse && !!owned?.curse?.active
  const blockId = `equip-block-${title.id}`

  return (
    <article
      className={cn(
        "group relative flex h-full flex-col gap-3 overflow-hidden rounded-xl border bg-card p-4 transition-colors",
        RARITY_FRAME[title.rarity],
        worn && "border-emerald-400/40",
        "hover:bg-[var(--color-navy-lighter)]/60"
      )}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          curse
            ? "via-rose-400/60"
            : title.tier === "legendary"
              ? "via-[var(--color-gold)]/80"
              : title.tier === "epic"
                ? "via-violet-300/60"
                : "via-[var(--color-gold)]/40"
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
            tier={title.tier}
            size="md"
            interactive
          />
          <p className={cn("text-[10px] font-semibold tracking-wider uppercase", RARITY_TEXT[title.rarity])}>
            {curse ? RARITY_LABEL.cursed : (CATEGORY_META[title.category]?.label ?? RARITY_LABEL[title.rarity])}
            <span className="text-muted-foreground">
              {curse ? " · bestowed on others" : ` · ${SLOT_LABEL[title.slot]} slot`}
            </span>
          </p>
          {typeof title.games === "number" && (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Hourglass aria-hidden className="size-3 shrink-0" />
              Lasts {gamesLabel(title.games)} per purchase
            </p>
          )}
        </div>
        <TierChip tier={title.tier} price={title.price} cursed={curse} />
      </header>

      <p className="text-xs text-muted-foreground italic">&ldquo;{title.description}&rdquo;</p>

      {!curse && (title.sets?.length ?? 0) > 0 && (
        <ul aria-label="Set bonuses" className="flex flex-wrap gap-1.5">
          {(title.sets ?? []).map((name) => {
            const set = titleSet(name)
            if (!set) return null
            const progress = sets.find((p) => p.set.name === name)
            return (
              <li
                key={name}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                  progress?.active ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100" : "border-border text-muted-foreground"
                )}
              >
                <Layers aria-hidden className="size-3" />
                {progress?.active ? `${name} active` : progressLabel({ set, count: progress?.count ?? 0 })}
                <InfoTip help={setHelp(set, progress?.count)} className="-my-1" />
              </li>
            )
          })}
        </ul>
      )}

      <EffectBox label={curse ? "While branded" : "While equipped"} cursed={curse}>
        <EffectLines effects={title.effects} cursed={curse} />
      </EffectBox>

      <EffectBox label={curse ? `After each game · ${CURSE_GAMES} games` : "After each game"} cursed={curse}>
        <PerkLine perk={title.perk} />
      </EffectBox>

      {curse && title.dignity_cost != null && (
        <p className="flex items-center gap-1.5 text-[11px] text-rose-200/80">
          <Flame aria-hidden className="size-3.5 shrink-0 text-rose-400" />
          Dignity buyback: <span className="font-semibold tabular-nums">{formatPrice(title.dignity_cost)}</span> points
        </p>
      )}

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          <Users aria-hidden className="size-3.5 shrink-0" />
          <span className="truncate">
            {title.holders === 0
              ? curse
                ? "Nobody branded yet"
                : "Be the first"
              : curse
                ? `${title.holders} branded so far`
                : `${title.holders} own it${title.wearing > 0 ? `, ${title.wearing} wearing` : ""}`}
          </span>
          <InfoTip help={titleHelp({ ...title, gamesLeft: owned?.games_left })} className="-my-1" />
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <InfoTip
            help={titleHelp({ name: title.name, category: title.category, perk: title.perk, price: title.price })}
            side="top"
            align="end"
          />
        {curse ? (
          <Button variant="destructive" className="h-10 gap-1.5 px-4" disabled={!signedIn || busy} onClick={() => onBestow(title)}>
            <Skull aria-hidden />
            Bestow
          </Button>
        ) : expired ? (
          <span className="flex items-center gap-2">
            <GamesLeftTag gamesLeft={0} />
            <Button className="h-10 gap-1.5 px-4" disabled={!signedIn || !affordable || busy} onClick={() => onBuy(title)}>
              <RotateCcw aria-hidden />
              {affordable ? `Renew · ${formatPrice(title.price)}` : "Too poor"}
            </Button>
          </span>
        ) : owned ? (
          worn ? (
            <span className="flex items-center gap-2">
              <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-200">
                <Check aria-hidden className="size-4" />
                Equipped
              </span>
              <GamesLeftTag gamesLeft={owned.games_left} />
              <Button variant="ghost" className="h-10 px-3 text-muted-foreground" disabled={locked || busy} onClick={() => onUnequip(title)}>
                Take off
              </Button>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <GamesLeftTag gamesLeft={owned.games_left} />
              <Button
                variant="outline"
                className="h-10 px-4"
                disabled={locked || busy || !!equipBlock}
                aria-describedby={equipBlock ? blockId : undefined}
                onClick={() => onEquip(title)}
              >
                Equip
              </Button>
            </span>
          )
        ) : (
          <Button className="h-10 px-4" disabled={!signedIn || !affordable || busy} onClick={() => onBuy(title)}>
            {affordable ? `Buy · ${formatPrice(title.price)}` : "Too poor"}
          </Button>
        )}
        </span>
      </footer>
      {!curse && !worn && !expired && equipBlock && (
        <p id={blockId} className="-mt-1 text-[11px] leading-snug text-amber-200/80">
          {owned ? equipBlock : `With your loadout: ${equipBlock}`}
        </p>
      )}
      {brandedOnMe && <p className="-mt-1 text-[11px] text-rose-300">This brand is currently burning on you.</p>}
    </article>
  )
}
