"use client"

import { BadgePercentIcon } from "lucide-react"
import { InfoTip } from "@/components/ui/info-tip"
import type { HelpEntry } from "@/lib/help"
import { display } from "@/lib/lore/herald/kit"
import { EFFECT_KEYS, noteChip, noteText, type EffectKey, type EffectNote } from "@/lib/titles/effects"
import { cn } from "@/lib/utils"

export type ChipTone = "boon" | "curse"

export interface TitleChipModel {
  key: string
  label: string
  tone: ChipTone
  detail?: string
}

const HARMFUL_KEYS: ReadonlySet<EffectKey> = new Set(["bet_cap", "insurance_blocked", "stipend_to_salaxe"])

export function noteTone(note: Pick<EffectNote, "key" | "value">): ChipTone {
  if (HARMFUL_KEYS.has(note.key)) return "curse"
  return note.key === "decree_cost_pct" && note.value > 0 ? "curse" : "boon"
}

// Royal Carpet is read from the target: say whose carpet it is, not "on you".
export function noteLabel(note: EffectNote): string {
  if (note.key === "decree_cost_target_pct") {
    const on = display(note.subject) ?? "the target"
    return `${note.title} ${EFFECT_KEYS.decree_cost_pct.chip(note.value)} on ${on}`
  }
  return noteChip(note)
}

export function noteDetail(note: EffectNote): string {
  if (note.key === "decree_cost_target_pct") return noteText({ ...note, subject: display(note.subject) })
  return noteText(note)
}

export function noteChips(notes: readonly EffectNote[], prefix = "note"): TitleChipModel[] {
  return notes.map((note, i) => ({
    key: `${prefix}-${note.title}-${note.key}-${note.subject ?? ""}-${i}`,
    label: noteLabel(note),
    tone: noteTone(note),
    detail: noteDetail(note),
  }))
}

const TONE_CLASS: Record<ChipTone, string> = {
  boon: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  curse: "border-dashed border-rose-400/45 bg-rose-500/10 text-rose-200",
}

export function TitleChip({ chip, size = "sm", className }: { chip: TitleChipModel; size?: "xs" | "sm"; className?: string }) {
  return (
    <span
      title={chip.detail}
      className={cn(
        "inline-flex max-w-full min-w-0 items-center gap-1 rounded-md border font-semibold leading-none whitespace-nowrap",
        size === "xs" ? "h-4 px-1 text-[9px] [&_svg]:size-2.5" : "h-5 px-1.5 text-[10px] [&_svg]:size-3",
        TONE_CLASS[chip.tone],
        className
      )}
    >
      <BadgePercentIcon aria-hidden className="shrink-0" />
      <span className="truncate">{chip.label}</span>
    </span>
  )
}

export function chipsHelp(title: string, does: string, chips: readonly TitleChipModel[]): HelpEntry {
  return {
    title,
    does,
    cost: chips.map((c) => c.detail ?? c.label).join(". ") + ".",
    limits: "Effects come from equipped titles and burning brands, and stack only up to each effect's cap.",
  }
}

interface TitleChipRowProps {
  chips: readonly TitleChipModel[]
  help?: HelpEntry
  size?: "xs" | "sm"
  className?: string
  label?: string
}

export function TitleChipRow({ chips, help, size = "sm", className, label = "Title effects" }: TitleChipRowProps) {
  if (chips.length === 0) return null
  return (
    <span role="list" aria-label={label} className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {chips.map((chip) => (
        <span role="listitem" key={chip.key} className="inline-flex min-w-0 max-w-full">
          <TitleChip chip={chip} size={size} />
        </span>
      ))}
      {help && <InfoTip help={help} className="size-4 [&_svg]:size-3.5" />}
    </span>
  )
}
