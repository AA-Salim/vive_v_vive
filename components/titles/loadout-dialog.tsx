"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { ArrowRight, Layers, Lock, Skull, Swords, Zap } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { TitleBadge } from "@/components/title-badge"
import { useMediaQuery } from "@/components/session/use-browser-state"
import { curseHelp, loadoutHelp, loadoutOf } from "@/components/titles/loadout-chips"
import { slotItemOf } from "@/components/titles/loadout-editor"
import { buildLoadout } from "@/components/titles/loadout-model"
import { ComboSummary, SlotRows, SlotRulesTips, type SlotItem } from "@/components/titles/loadout-parts"
import { useAuth } from "@/hooks/use-auth"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import { effectsOfEquipped } from "@/hooks/use-title-effects"
import { cn } from "@/lib/utils"
import { HALL_COPY } from "@/lib/titles/copy"
import { effectSummary } from "@/lib/titles/effects"
import { LOADOUT_SLOTS, MAX_EQUIPPED, SLOT_COUNT, SLOT_LABEL, type LoadoutSlot } from "@/lib/titles/loadout"
import { shopPrice } from "@/lib/titles/pricing"
import type { TitleView } from "@/lib/titles/types"
import { useSetLoadout, useTitlesCatalog, useTitlesSealed } from "@/lib/titles/use-titles"

// The loadout as a popup, mountable from any page: a bottom drawer on phones, a dialog on wider screens.
// edit: the signed-in user's own loadout (GET /api/titles). view: anyone's build, read-only (GET /api/titles/equipped).

export type LoadoutDialogMode = "edit" | "view"

export interface LoadoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Whose loadout. In edit mode it must be the signed-in user; anyone else falls back to view.
  userId: string | null
  mode: LoadoutDialogMode
  // Display name for the view title ("<name>'s strategy").
  name?: string | null
  // Edit mode: open with "Your titles" filtered to this slot tier (an empty slot was tapped).
  slot?: LoadoutSlot | null
}

const RANK: Record<string, number> = { legendary: 0, epic: 1, rare: 2, common: 3 }

function possessive(name: string | null | undefined): string {
  if (!name) return "Their"
  return name.endsWith("s") ? `${name}'` : `${name}'s`
}

export function LoadoutDialog({ open, onOpenChange, userId, mode, name, slot = null }: LoadoutDialogProps) {
  const desktop = useMediaQuery("(min-width: 768px)")
  const { user } = useAuth()
  const editing = mode === "edit" && !!user && (!userId || userId === user.id)
  const title = editing ? "Your loadout" : `${possessive(name)} strategy`
  const description = editing
    ? `Wear up to ${MAX_EQUIPPED} titles: ${LOADOUT_SLOTS.map((s) => `${SLOT_COUNT[s]} ${SLOT_LABEL[s]}`).join(", ")}. Their effects stack, each one capped.`
    : `What ${name ?? "they"} wear${name ? "s" : ""}, and what it does to every decree, bet, praise and duel.`
  const body: ReactNode = open ? (
    editing ? (
      <EditBody slot={slot} />
    ) : (
      <ViewBody userId={userId ?? user?.id ?? null} name={name ?? null} />
    )
  ) : null

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] gap-4 overflow-y-auto border border-[var(--color-gold)]/25 bg-[var(--color-navy-light)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2 text-xl text-[var(--color-gold)]">
              <Layers aria-hidden className="size-5" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {body}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="px-1">
          <DrawerTitle className="flex items-center gap-2">
            <Layers aria-hidden className="size-5 text-[var(--color-gold)]" />
            {title}
          </DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        {body}
      </DrawerContent>
    </Drawer>
  )
}

function EditBody({ slot }: { slot: LoadoutSlot | null }) {
  const catalog = useTitlesCatalog()
  const equip = useSetLoadout()
  const loadout = useMemo(() => buildLoadout(catalog.data), [catalog.data])
  const [focus, setFocus] = useState<LoadoutSlot | null>(slot)
  const data = catalog.data

  if (catalog.isLoading || !data) {
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  const titleById = new Map(data.titles.map((t) => [t.id, t]))
  const worn = new Map(loadout.worn.map((w) => [w.title.id, w.title]))
  const spare = data.collection
    .flatMap((owned) => {
      const title = titleById.get(owned.title_id)
      if (!title || owned.is_active || owned.curse?.active) return []
      return [{ title, owned }]
    })
    .sort(
      (a, b) =>
        LOADOUT_SLOTS.indexOf(a.title.slot) - LOADOUT_SLOTS.indexOf(b.title.slot) ||
        RANK[a.title.tier] - RANK[b.title.tier] ||
        a.title.name.localeCompare(b.title.name)
    )
  const shown = focus ? spare.filter((s) => s.title.slot === focus) : spare
  const burning = data.collection.flatMap((owned) => {
    const title = titleById.get(owned.title_id)
    return title && owned.curse?.active ? [{ title, owned }] : []
  })
  const pending = equip.isPending
  const disabled = loadout.locked || pending

  const put = (title: TitleView) => equip.mutate({ titleIds: loadout.idsWith(title), change: { title, equipped: true } })
  const takeOff = (title: TitleView) => equip.mutate({ titleIds: loadout.idsWithout(title), change: { title, equipped: false } })

  return (
    <div className="space-y-4">
      {loadout.locked && (
        <Alert className="border-amber-400/30 bg-amber-400/10 text-amber-100">
          <Lock aria-hidden />
          <AlertDescription className="text-amber-100/90">{HALL_COPY.lockNotice}</AlertDescription>
        </Alert>
      )}
      {!loadout.enabled && <p className="text-xs text-amber-200/90">{HALL_COPY.loadoutsPending}</p>}

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {loadout.worn.length} of {MAX_EQUIPPED} slots filled
        </p>
        <SlotRulesTips />
      </div>

      <SlotRows
        items={loadout.worn.map(slotItemOf)}
        disabled={disabled}
        onRemove={(key) => {
          const title = worn.get(key)
          if (title) takeOff(title)
        }}
        onEmpty={(slot) => setFocus(slot)}
      />

      <section aria-label="Your titles" className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="mr-auto text-[11px] font-bold tracking-wider text-[var(--color-gold)]/80 uppercase">Your titles</h3>
          {[null, ...LOADOUT_SLOTS].map((slot) => (
            <button
              key={slot ?? "all"}
              type="button"
              aria-pressed={focus === slot}
              onClick={() => setFocus(slot)}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60",
                focus === slot
                  ? "border-[var(--color-gold)]/50 bg-[var(--color-gold)]/15 text-[var(--color-gold-light)]"
                  : "border-border text-muted-foreground hover:text-[var(--color-gold-light)]"
              )}
            >
              {slot ? SLOT_LABEL[slot] : "All"}
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            {spare.length === 0 ? "Everything you own is already worn." : "Nothing of that tier left in your wardrobe."}
          </p>
        ) : (
          <ul className="space-y-1.5">
            {shown.map(({ title, owned }) => {
              const block = loadout.blockFor(title)
              const effect = title.for_self ? effectSummary(title.name) : null
              return (
                <li key={title.id} className="flex items-start gap-2 rounded-lg border border-border bg-[var(--color-navy)]/50 p-2">
                  <span className="min-w-0 flex-1">
                    <TitleBadge
                      name={title.name}
                      category={title.category}
                      rarity={title.rarity}
                      perk={owned.perk}
                      price={title.price}
                      tier={title.tier}
                      description={title.description}
                      interactive
                    />
                    <span className="mt-1 flex gap-1 text-[11px] leading-snug text-[var(--color-gold-light)]/80">
                      <Zap aria-hidden className="mt-px size-3 shrink-0 text-[var(--color-gold)]" />
                      {effect ?? (title.for_self ? "No immediate effect: its perk pays after the game." : "A cold scar: cosmetic.")}
                    </span>
                    {block && <span className="mt-1 block text-[11px] text-rose-200/90">{block}</span>}
                  </span>
                  <Button variant="outline" className="h-10 shrink-0 px-3" disabled={disabled || !!block} onClick={() => put(title)}>
                    Equip
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {burning.length > 0 && (
        <section aria-label="Brands burning on you" className="space-y-1.5">
          <h3 className="text-[11px] font-bold tracking-wider text-rose-300 uppercase">Brands burning on you · no slot</h3>
          <ul className="space-y-1.5">
            {burning.map(({ title, owned }) => (
              <li key={title.id} className="rounded-lg border border-rose-500/25 bg-rose-500/[0.06] p-2">
                <TitleBadge
                  name={title.name}
                  category={title.category}
                  perk={owned.perk}
                  price={title.price}
                  curse={{ bestowedBy: owned.bestowed_by?.name, gamesLeft: owned.curse?.left }}
                  interactive
                />
                <span className="mt-1 flex gap-1 text-[11px] leading-snug text-rose-100/90">
                  <Skull aria-hidden className="mt-px size-3 shrink-0 text-rose-400" />
                  {effectSummary(title.name) ?? "Bites after each game."}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ComboSummary fx={loadout.fx} />

      <Link href="/titles" className="inline-flex h-10 items-center gap-1.5 text-sm font-medium text-[var(--color-gold)] hover:underline">
        More titles in the Hall of Titles
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    </div>
  )
}

function ViewBody({ userId, name }: { userId: string | null; name: string | null }) {
  const { byUserId } = useEquippedTitles()
  const entry = userId ? byUserId.get(userId) : undefined
  const items: SlotItem[] = (entry ? loadoutOf(entry) : []).map((t) => ({
    key: t.title,
    name: t.title,
    category: t.category,
    rarity: t.rarity,
    tier: t.tier,
    slot: t.slot,
    primary: t.primary,
    price: t.category === "award" ? 0 : shopPrice(t.title, 0),
    perk: t.perk,
    help: loadoutHelp(t),
  }))
  const curses = entry?.curses ?? []
  const fx = effectsOfEquipped(entry)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {items.length === 0 ? "No title worn." : `${items.length} of ${MAX_EQUIPPED} slots filled`}
        </p>
        <SlotRulesTips />
      </div>

      <SlotRows items={items} />

      {curses.length > 0 && (
        <section aria-label="Brands burning" className="space-y-1.5">
          <h3 className="text-[11px] font-bold tracking-wider text-rose-300 uppercase">Brands burning · no slot</h3>
          <ul className="space-y-1.5">
            {curses.map((curse) => (
              <li key={curse.title} className="flex items-start gap-2 rounded-lg border border-rose-500/25 bg-rose-500/[0.06] p-2">
                <span className="min-w-0 flex-1">
                  <TitleBadge name={curse.title} category="mockery" rarity="cursed" perk={curse.perk} />
                  <span className="mt-1 flex gap-1 text-[11px] leading-snug text-rose-100/90">
                    <Skull aria-hidden className="mt-px size-3 shrink-0 text-rose-400" />
                    {curse.effect ?? "Bites after each game."}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">
                    {curse.bestowedBy ? `Branded by ${curse.bestowedBy} · ` : ""}
                    {curse.gamesLeft} game{curse.gamesLeft === 1 ? "" : "s"} left
                  </span>
                </span>
                <InfoTip help={curseHelp(curse)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <ComboSummary
        fx={fx}
        heading={name ? `${possessive(name)} combo` : "Their combo"}
        emptyLabel="No title acts on them right now."
      />
    </div>
  )
}

interface LoadoutTriggerProps {
  isSelf: boolean
  onClick: () => void
  // Yourself only: a live game seals the loadout. The dialog still opens, read-only, with the seal notice.
  sealed?: boolean
  label?: string
  className?: string
  variant?: "outline" | "ghost" | "default" | "royal"
  size?: "default" | "lg" | "xl"
}

// The button alone, for surfaces that own the dialog (the profile hero opens it from empty slots too).
export function LoadoutTrigger({ isSelf, onClick, sealed = false, label, className, variant, size = "lg" }: LoadoutTriggerProps) {
  const Icon = !isSelf ? Swords : sealed ? Lock : Layers
  const text = label ?? (isSelf ? "Manage loadout" : "See their strategy")
  return (
    <Button
      variant={variant ?? "outline"}
      size={size}
      className={cn("gap-1.5", sealed && "border-amber-400/40 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15", className)}
      onClick={onClick}
    >
      <Icon aria-hidden />
      {isSelf && sealed ? (
        <span className="flex flex-col items-start leading-tight">
          <span>{text}</span>
          <span className="text-[10px] font-normal text-amber-200/80">Sealed while a game is live</span>
        </span>
      ) : (
        text
      )}
    </Button>
  )
}

function SealedTrigger(props: Omit<LoadoutTriggerProps, "sealed" | "isSelf">) {
  return <LoadoutTrigger {...props} isSelf sealed={useTitlesSealed()} />
}

export interface LoadoutButtonProps {
  userId: string | null
  isSelf: boolean
  name?: string | null
  className?: string
  variant?: "outline" | "ghost" | "default" | "royal"
}

// "Manage loadout" for yourself, "See their strategy" for anyone else; opens LoadoutDialog.
export function LoadoutButton({ userId, isSelf, name, className, variant = "outline" }: LoadoutButtonProps) {
  const [open, setOpen] = useState(false)
  const trigger = { onClick: () => setOpen(true), className: cn("h-10", className), variant }
  return (
    <>
      {isSelf ? <SealedTrigger {...trigger} /> : <LoadoutTrigger {...trigger} isSelf={false} />}
      <LoadoutDialog open={open} onOpenChange={setOpen} userId={userId} mode={isSelf ? "edit" : "view"} name={name} />
    </>
  )
}
