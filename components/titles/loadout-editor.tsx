"use client"

import { Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { LoadoutModel, WornTitle } from "@/components/titles/loadout-model"
import { ComboSummary, SlotRows, SlotRulesTips, type SlotItem } from "@/components/titles/loadout-parts"
import { MAX_EQUIPPED } from "@/lib/titles/loadout"
import type { TitleView } from "@/lib/titles/types"

interface LoadoutEditorProps {
  loadout: LoadoutModel
  pending: boolean
  onRemove: (title: TitleView) => void
  onClear: () => void
  onBrowse: (tab: "collection" | "armory") => void
  // Opens the read-only strategy view other players see.
  onPreview?: () => void
}

export function slotItemOf(worn: WornTitle): SlotItem {
  return {
    key: worn.title.id,
    name: worn.title.name,
    category: worn.title.category,
    rarity: worn.title.rarity,
    tier: worn.title.tier,
    slot: worn.slot,
    primary: worn.primary,
    price: worn.title.price,
    perk: worn.owned.perk,
    description: worn.title.description,
  }
}

export function LoadoutEditor({ loadout, pending, onRemove, onClear, onBrowse, onPreview }: LoadoutEditorProps) {
  const disabled = loadout.locked || pending
  const byId = new Map(loadout.worn.map((w) => [w.title.id, w.title]))

  return (
    <div className="space-y-4">
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
          const title = byId.get(key)
          if (title) onRemove(title)
        }}
        onEmpty={(slot) => onBrowse(slot === "common" ? "collection" : "armory")}
      />

      <ComboSummary fx={loadout.fx} />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-10 flex-1" disabled={loadout.locked} onClick={() => onBrowse("collection")}>
          Change titles
        </Button>
        <Button
          variant="ghost"
          className="h-10 flex-1 text-muted-foreground"
          disabled={disabled || loadout.worn.length === 0}
          onClick={onClear}
        >
          Take all off
        </Button>
        {onPreview && (
          <Button variant="ghost" className="h-10 w-full gap-1.5 text-[var(--color-gold-light)]/80" onClick={onPreview}>
            <Eye aria-hidden />
            See it as others do
          </Button>
        )}
      </div>
    </div>
  )
}
