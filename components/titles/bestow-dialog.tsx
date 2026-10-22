"use client"

import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Coins, Flame, Search, Skull, Stamp } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { HelpRows } from "@/components/ui/info-tip"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { InfoTip } from "@/components/ui/info-tip"
import { TitleBadge } from "@/components/title-badge"
import { EffectBox, EffectLines } from "@/components/titles/effect-lines"
import { PerkLine } from "@/components/titles/perk-line"
import { TierChip } from "@/components/titles/tier-chip"
import { useMyTitleEffects } from "@/hooks/use-title-effects"
import { cn } from "@/lib/utils"
import { perkInfo } from "@/lib/titles/catalog"
import { proclamation, roastFor } from "@/lib/titles/copy"
import { bestowPrice, effectNotes, noteChip } from "@/lib/titles/effects"
import { titleHelp } from "@/lib/titles/help"
import { formatPrice } from "@/lib/titles/pricing"
import { CURSE_GAMES, MAX_ACTIVE_CURSES } from "@/lib/titles/rules"
import { useCourt } from "@/lib/titles/use-titles"
import type { CourtMember, TitleView } from "@/lib/titles/types"

interface BestowDialogProps {
  title: TitleView | null
  me: { id: string; name: string } | null
  balance: number | null
  migrated: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (title: TitleView, target: CourtMember) => void
}

function blockReason(member: CourtMember, title: TitleView, migrated: boolean): string | null {
  if (member.curses.some((c) => c.title === title.name)) return "Already wears this brand"
  if (member.curses.length >= MAX_ACTIVE_CURSES) return `Carries ${MAX_ACTIVE_CURSES} brands already`
  if (!migrated && member.owned_title_ids.includes(title.id)) return "Bears the old scar"
  return null
}

export function BestowDialog(props: BestowDialogProps) {
  return (
    <Dialog open={!!props.title} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border border-rose-500/30 bg-[var(--color-navy-light)] sm:max-w-lg">
        {props.title && <BestowBody key={props.title.id} {...props} title={props.title} />}
      </DialogContent>
    </Dialog>
  )
}

function BestowBody({ title, me, balance, migrated, pending, onOpenChange, onConfirm }: BestowDialogProps & { title: TitleView }) {
  const reduce = useReducedMotion()
  const [query, setQuery] = useState("")
  const [targetId, setTargetId] = useState<string | null>(null)
  const court = useCourt(true)

  const members = (court.data?.members ?? []).filter((m) => m.id !== me?.id)
  const needle = query.trim().toLowerCase()
  const visible = needle
    ? members.filter((m) => m.name.toLowerCase().includes(needle) || m.username.toLowerCase().includes(needle))
    : members
  const target = members.find((m) => m.id === targetId) ?? null
  const curse = perkInfo(title.name, title.category, "you")
  const { fx } = useMyTitleEffects()
  const price = bestowPrice(title.price, fx)
  const discounts = price !== title.price ? effectNotes(fx, "bestow_cost_pct") : []
  const cantAfford = balance !== null && balance - price < -300

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display flex items-center gap-2 text-xl text-rose-200">
          <Skull aria-hidden className="size-5 text-rose-400" />
          Bestow a curse
        </DialogTitle>
        <DialogDescription>
          Pick a subject. The brand burns for {CURSE_GAMES} games and every bite pays you.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2 rounded-xl border border-rose-500/20 bg-rose-500/[0.05] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TitleBadge name={title.name} category={title.category} rarity={title.rarity} size="md" interactive={false} />
          <span className="flex items-center gap-1">
            <TierChip tier={title.tier} price={title.price} cursed />
            <InfoTip help={titleHelp(title)} align="end" />
          </span>
        </div>
        <EffectBox label="While branded, the moment it lands" cursed>
          <EffectLines effects={title.effects} cursed />
        </EffectBox>
        <EffectBox label="After each game" cursed>
          <PerkLine perk={curse} />
        </EffectBox>
        {title.dignity_cost != null && (
          <p className="flex items-center gap-1.5 text-[11px] text-rose-200/80">
            <Flame aria-hidden className="size-3 shrink-0 text-rose-400" />
            They can buy back their dignity for {formatPrice(title.dignity_cost)} points.
          </p>
        )}
        <div className="border-t border-rose-500/15 pt-2">
          <HelpRows help={titleHelp({ name: title.name, category: title.category, perk: curse, price: title.price, tier: title.tier })} />
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="bestow-search" className="sr-only">
          Search the court
        </label>
        <div className="relative">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="bestow-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the court..."
            className="h-10 pl-9"
            autoComplete="off"
          />
        </div>
        <div role="radiogroup" aria-label="Choose who to curse" className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {court.isLoading ? (
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)
          ) : court.error ? (
            <p className="p-3 text-center text-xs text-muted-foreground">The court roll could not be read. Close and try again.</p>
          ) : visible.length === 0 ? (
            <p className="p-3 text-center text-xs text-muted-foreground">Nobody by that name. Lucky them.</p>
          ) : (
            visible.map((member) => {
              const blocked = blockReason(member, title, migrated)
              const selected = member.id === targetId
              return (
                <button
                  key={member.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-disabled={!!blocked}
                  disabled={!!blocked}
                  onClick={() => setTargetId(member.id)}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-lg border px-2.5 py-1.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60",
                    selected
                      ? "border-rose-400/60 bg-rose-500/15"
                      : "border-transparent hover:border-border hover:bg-[var(--color-navy)]/60",
                    blocked && "cursor-not-allowed opacity-50"
                  )}
                >
                  <Avatar size="sm">
                    {member.avatar_url ? <AvatarImage src={member.avatar_url} alt="" /> : null}
                    <AvatarFallback>{member.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-[var(--color-gold-light)]">{member.name}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {blocked ?? (member.equipped ? `Wears ${member.equipped}` : "No banner raised")}
                    </span>
                  </span>
                  {member.curses.length > 0 && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] text-rose-300" aria-label={`${member.curses.length} active brands`}>
                      {member.curses.map((c) => (
                        <Skull key={c.title} aria-hidden className="size-3.5" />
                      ))}
                    </span>
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {target && (
          <motion.div
            key={target.id}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0 }}
            className="relative overflow-hidden rounded-xl border border-[var(--color-gold)]/30 bg-gradient-to-br from-[var(--color-gold)]/10 to-rose-500/10 p-4"
          >
            <Stamp aria-hidden className="absolute -top-2 -right-2 size-14 rotate-12 text-[var(--color-gold)]/10" />
            <p className="text-[10px] font-bold tracking-[0.2em] text-[var(--color-gold)]/80 uppercase">Royal proclamation</p>
            <p className="font-display mt-1.5 text-base leading-snug text-[var(--color-gold-light)]">
              {proclamation(me?.name ?? "the Crown", target.name, title.name)}
            </p>
            <p className="mt-2 text-xs text-[var(--color-gold-light)]/75 italic">{roastFor(title.name, target.name)}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5 text-sm">
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Coins aria-hidden className="size-4 text-[var(--color-gold)]" />
          Price
          {price !== title.price && <span className="tabular-nums line-through">{formatPrice(title.price)}</span>}
          <span className="font-semibold text-[var(--color-gold-light)] tabular-nums">{formatPrice(price)}</span>
        </span>
        {discounts.map((note) => (
          <span
            key={note.title}
            className="inline-flex h-6 items-center rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 text-[11px] font-semibold text-emerald-200"
          >
            {noteChip(note)}
          </span>
        ))}
      </div>

      <DialogFooter className="bg-transparent">
        <Button variant="outline" className="h-10" onClick={() => onOpenChange(false)}>
          Show mercy
        </Button>
        <Button
          variant="destructive"
          className="h-10 gap-1.5"
          disabled={!target || pending || cantAfford}
          onClick={() => target && onConfirm(title, target)}
        >
          <Coins aria-hidden />
          {pending ? "Branding..." : cantAfford ? "Too poor to curse" : `Bestow for ${formatPrice(price)}`}
        </Button>
      </DialogFooter>
    </>
  )
}
