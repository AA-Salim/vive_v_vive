"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Crown, Gauge, Plus, Skull, X, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { TitleBadge } from "@/components/title-badge"
import { cn } from "@/lib/utils"
import { FREE, type HelpEntry } from "@/lib/help"
import { comboLines, DOMAIN_LABEL, effectSummary, type CombinedEffects } from "@/lib/titles/effects"
import { FACTION_REASON, LOADOUT_SLOTS, MAX_EQUIPPED, SLOT_COUNT, SLOT_HINT, SLOT_LABEL, TITLE_CONFLICTS, type LoadoutSlot } from "@/lib/titles/loadout"
import type { PriceTier } from "@/lib/titles/pricing"
import { USER_PERK_CAP } from "@/lib/titles/rules"
import type { PerkInfo, TitleRarity } from "@/lib/titles/types"

// The pieces every loadout view shares: the /titles editor, the loadout dialog (edit and view) and the profile.

export const SLOT_HELP: HelpEntry = {
  title: "Loadout slots",
  does: `Wear up to ${MAX_EQUIPPED} titles at once: ${LOADOUT_SLOTS.map((s) => `${SLOT_COUNT[s]} ${SLOT_LABEL[s]}`).join(", ")}. Their immediate effects combine, each one capped, and every perk pays after the game.`,
  cost: `${FREE} to change between games`,
  reward: `All your post-game perks together pay at most ${USER_PERK_CAP} points a game.`,
  limits: `${LOADOUT_SLOTS.map((s) => `${SLOT_LABEL[s]}: ${SLOT_HINT[s]}`).join(". ")}. Brands burning on you never take a slot. Titles are sealed while a game is live.`,
}

export const CONFLICT_HELP: HelpEntry = {
  title: "Titles that never mix",
  does: TITLE_CONFLICTS.map((c) => `${c.titles[0]} and ${c.titles[1]}: ${c.reason}`).join(" "),
  cost: FREE,
  limits: FACTION_REASON,
}

export const COMBO_HELP: HelpEntry = {
  title: "This combo gives you",
  does: "Every immediate effect of the equipped titles and of the brands burning, added together. It applies the moment an action is taken: decree prices, bet terms, praise, stipends and duels.",
  cost: FREE,
  reward: `Post-game perks pay separately, ${USER_PERK_CAP} points a game at most, all titles together.`,
  limits: "Each effect stacks up to its cap, written under it. Curses always win over the perks they fight.",
}

export interface SlotItem {
  key: string
  name: string
  category: string
  rarity: TitleRarity
  tier: PriceTier
  slot: LoadoutSlot
  primary: boolean
  price?: number
  perk?: PerkInfo | string | null
  description?: string | null
  // A bubble for read-only views; editable tiles open the badge popover instead.
  help?: HelpEntry
}

function SlotTile({ item, disabled, onRemove }: { item: SlotItem; disabled: boolean; onRemove?: () => void }) {
  const effect = item.category === "mockery" ? null : effectSummary(item.name)
  return (
    <div
      className={cn(
        "flex min-h-12 items-start gap-1.5 rounded-lg border bg-[var(--color-navy)]/70 py-1.5 pr-1 pl-2",
        item.primary ? "border-[var(--color-gold)]/50" : "border-border"
      )}
    >
      {item.primary && <Crown aria-label="Primary title" className="mt-1.5 size-3.5 shrink-0 text-[var(--color-gold)]" />}
      <span className="min-w-0 flex-1 py-0.5">
        <TitleBadge
          name={item.name}
          category={item.category}
          rarity={item.rarity}
          perk={item.perk}
          price={item.price}
          tier={item.tier}
          description={item.description}
          interactive={!item.help}
        />
        <span className="mt-1 flex gap-1 text-[11px] leading-snug text-[var(--color-gold-light)]/80">
          <Zap aria-hidden className="mt-px size-3 shrink-0 text-[var(--color-gold)]" />
          {effect ?? "No immediate effect: its perk pays after the game."}
        </span>
      </span>
      {item.help && <InfoTip help={item.help} className="mt-1" />}
      {onRemove && (
        <Button
          variant="ghost"
          size="icon"
          className="size-10 shrink-0 text-muted-foreground hover:text-rose-200"
          aria-label={`Take off ${item.name}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <X aria-hidden />
        </Button>
      )}
    </div>
  )
}

function EmptySlot({ slot, onAdd, disabled }: { slot: LoadoutSlot; onAdd?: () => void; disabled: boolean }) {
  const label = `Empty ${SLOT_LABEL[slot]} slot`
  const classes =
    "flex min-h-12 items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/80 text-[11px] text-muted-foreground"
  if (!onAdd) return <div className={classes}>{label}</div>
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className={cn(
        classes,
        "transition-colors outline-none hover:border-[var(--color-gold)]/40 hover:text-[var(--color-gold-light)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60 disabled:pointer-events-none disabled:opacity-50"
      )}
    >
      <Plus aria-hidden className="size-3.5" />
      {label}
    </button>
  )
}

interface SlotRowsProps {
  items: SlotItem[]
  disabled?: boolean
  onRemove?: (key: string) => void
  onEmpty?: (slot: LoadoutSlot) => void
}

// The three tier rows with their filled and empty slots.
export function SlotRows({ items, disabled = false, onRemove, onEmpty }: SlotRowsProps) {
  const reduce = useReducedMotion()
  return (
    <div className="space-y-4">
      {LOADOUT_SLOTS.map((slot) => {
        const filled = items.filter((i) => i.slot === slot)
        const empty = Math.max(0, SLOT_COUNT[slot] - filled.length)
        return (
          <section key={slot} aria-label={`${SLOT_LABEL[slot]} slots`} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <h3
                className={cn(
                  "text-[11px] font-bold tracking-wider uppercase",
                  slot === "super_rare" ? "text-violet-200" : slot === "rare" ? "text-sky-200" : "text-[var(--color-gold-light)]/70"
                )}
              >
                {SLOT_LABEL[slot]}{" "}
                <span className="font-semibold text-muted-foreground tabular-nums">
                  {filled.length}/{SLOT_COUNT[slot]}
                </span>
              </h3>
              <span className="truncate text-[10px] text-muted-foreground">{SLOT_HINT[slot]}</span>
            </div>
            <div className="grid gap-1.5">
              <AnimatePresence initial={false}>
                {filled.map((item) => (
                  <motion.div
                    key={item.key}
                    layout={!reduce}
                    initial={reduce ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, scale: 0.97 }}
                  >
                    <SlotTile item={item} disabled={disabled} onRemove={onRemove ? () => onRemove(item.key) : undefined} />
                  </motion.div>
                ))}
              </AnimatePresence>
              {Array.from({ length: empty }, (_, i) => (
                <EmptySlot key={i} slot={slot} disabled={disabled} onAdd={onEmpty ? () => onEmpty(slot) : undefined} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export function SlotRulesTips() {
  return (
    <span className="flex items-center gap-1">
      <InfoTip help={SLOT_HELP} align="end" />
      <InfoTip help={CONFLICT_HELP} align="end">
        <Skull aria-hidden className="size-3.5" />
      </InfoTip>
    </span>
  )
}

interface ComboSummaryProps {
  fx: CombinedEffects
  heading?: string
  emptyLabel?: string
}

// "This combo gives you": every combined effect with its sources and its stacking cap.
export function ComboSummary({ fx, heading = "This combo gives you", emptyLabel }: ComboSummaryProps) {
  const combo = comboLines(fx)
  return (
    <section aria-label={heading} className="space-y-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.04] p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-amber-200 uppercase">
          <Zap aria-hidden className="size-3.5" />
          {heading}
        </h3>
        <InfoTip help={COMBO_HELP} align="end" />
      </div>
      {combo.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {emptyLabel ?? "Nothing yet. Equip a title to bend decrees, bets, praise and duels in your favor."}
        </p>
      ) : (
        <ul className="space-y-2">
          {combo.map((line) => (
            <li key={line.key} className="flex items-start gap-2">
              {line.cursed ? (
                <Skull aria-hidden className="mt-0.5 size-3.5 shrink-0 text-rose-400" />
              ) : (
                <Zap aria-hidden className="mt-0.5 size-3.5 shrink-0 text-amber-300" />
              )}
              <div className="min-w-0 text-xs leading-snug">
                <p className={cn(line.cursed ? "text-rose-100" : "text-[var(--color-gold-light)]")}>
                  <span className="font-semibold">{line.text}</span>
                  {line.capped && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-sm bg-amber-400/15 px-1 align-middle text-[9px] font-bold text-amber-200 uppercase">
                      <Gauge aria-hidden className="size-2.5" />
                      Capped
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {DOMAIN_LABEL[line.domain]} · from {line.titles.join(", ")} · {line.stacking}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
