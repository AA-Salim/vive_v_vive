"use client"

import Image from "next/image"
import { CheckIcon, ShieldCheckIcon, ShieldXIcon } from "lucide-react"
import { getChampionImageUrl, ROLE_LABELS } from "@/lib/champions"
import { sideName } from "@/lib/chaos/rules"
import type { BoardAssignment } from "@/lib/chaos/types"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"
import { LaneIcon } from "@/components/lane-icon"
import { TitleChip, type TitleChipModel } from "@/components/chaos/title-chips"
import { SIDE_STYLES } from "@/components/chaos/tier-styles"

const SIDES: Side[] = ["blue", "red"]
const LANE_ORDER = ["top", "jungle", "mid", "adc", "support"]

export function ChampionPortrait({ seat, size = 36 }: { seat: Pick<BoardAssignment, "champion" | "champion_internal" | "side">; size?: number }) {
  return (
    <span
      className={cn("relative shrink-0 overflow-hidden rounded-full ring-2", SIDE_STYLES[seat.side].ring)}
      style={{ width: size, height: size }}
    >
      <Image
        src={getChampionImageUrl(seat.champion_internal)}
        alt={seat.champion}
        width={size}
        height={size}
        className="size-full object-cover"
        unoptimized
      />
    </span>
  )
}

export interface SideOption {
  side: Side
  block: string | null
  hint: string
  chips?: TitleChipModel[]
}

interface SideChoiceProps {
  label: string
  value: Side | null
  options: SideOption[]
  onChange: (side: Side) => void
}

export function SideChoice({ label, value, options, onChange }: SideChoiceProps) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-2 gap-2">
      {options.map(({ side, block, hint, chips = [] }) => {
        const selected = value === side
        const style = SIDE_STYLES[side]
        return (
          <button
            key={side}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={!!block}
            onClick={() => onChange(side)}
            className={cn(
              "flex min-h-[84px] flex-col items-start gap-1 rounded-xl border p-3 text-left outline-none transition-all",
              "focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/70",
              style.border,
              selected ? cn(style.wash, "ring-2", style.ring) : "bg-[var(--color-navy)]/60 hover:bg-[var(--color-navy-lighter)]/60",
              block && "cursor-not-allowed opacity-50"
            )}
          >
            <span className={cn("flex w-full items-center justify-between font-display text-base font-semibold", style.text)}>
              {sideName(side)} side
              {selected && <CheckIcon aria-hidden className="size-4" />}
            </span>
            <span className="text-[11px] leading-snug text-[var(--color-gold-light)]/60">{block ?? hint}</span>
            {chips.length > 0 && (
              <span className="flex max-w-full flex-wrap gap-1">
                {chips.map((chip) => (
                  <TitleChip key={chip.key} chip={chip} size="xs" />
                ))}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export interface PlayerOption {
  seat: BoardAssignment
  block: string | null
  pardoned: boolean
  immune?: boolean
  chips?: TitleChipModel[]
}

interface PlayerChoiceProps {
  label: string
  mode: "single" | "pair"
  selected: string[]
  options: PlayerOption[]
  viewerPlayerId: string | null
  onToggle: (assignmentId: string) => void
}

export function PlayerChoice({ label, mode, selected, options, viewerPlayerId, onToggle }: PlayerChoiceProps) {
  const role = mode === "single" ? "radio" : "checkbox"
  const sides = SIDES.filter((side) => options.some((o) => o.seat.side === side))

  return (
    <div role={mode === "single" ? "radiogroup" : "group"} aria-label={label} className="grid gap-3 sm:grid-cols-2">
      {sides.map((side) => (
        <div key={side} className="space-y-1.5">
          <div className={cn("text-[11px] font-semibold uppercase tracking-wider", SIDE_STYLES[side].text)}>
            {sideName(side)} side
          </div>
          {options
            .filter((o) => o.seat.side === side)
            .sort((a, b) => LANE_ORDER.indexOf(a.seat.lane) - LANE_ORDER.indexOf(b.seat.lane))
            .map(({ seat, block, pardoned, immune = false, chips = [] }) => {
              const isSelected = selected.includes(seat.id)
              const isViewer = !!viewerPlayerId && seat.player_id === viewerPlayerId
              return (
                <button
                  key={seat.id}
                  type="button"
                  role={role}
                  aria-checked={isSelected}
                  disabled={!!block && !isSelected}
                  onClick={() => onToggle(seat.id)}
                  className={cn(
                    "flex min-h-[52px] w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left outline-none transition-all",
                    "focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/70",
                    isSelected
                      ? cn("border-transparent ring-2", SIDE_STYLES[side].ring, SIDE_STYLES[side].wash)
                      : "border-[var(--color-gold)]/10 bg-[var(--color-navy)]/60 hover:border-[var(--color-gold)]/30",
                    block && !isSelected && "cursor-not-allowed opacity-45"
                  )}
                >
                  <ChampionPortrait seat={seat} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-[var(--color-gold-light)]">{seat.name}</span>
                      {isViewer && (
                        <span className="rounded bg-[var(--color-gold)]/15 px-1 text-[10px] font-semibold uppercase text-[var(--color-gold)]">
                          You
                        </span>
                      )}
                      {pardoned && <ShieldCheckIcon aria-label="Pardoned" className="size-3.5 shrink-0 text-emerald-300" />}
                      {immune && <ShieldXIcon aria-label="Cannot be exiled" className="size-3.5 shrink-0 text-rose-300" />}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-[var(--color-gold-light)]/55">
                      <LaneIcon lane={seat.lane} size={12} className="shrink-0" />
                      <span className="truncate">
                        {ROLE_LABELS[seat.lane]} · {seat.champion}
                      </span>
                    </span>
                    {chips.length > 0 && (
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {chips.map((chip) => (
                          <TitleChip key={chip.key} chip={chip} size="xs" />
                        ))}
                      </span>
                    )}
                  </span>
                  {isSelected ? (
                    <CheckIcon aria-hidden className="size-4 shrink-0 text-[var(--color-gold)]" />
                  ) : (
                    block && <span className="shrink-0 text-[10px] text-[var(--color-gold-light)]/60">{block}</span>
                  )}
                </button>
              )
            })}
        </div>
      ))}
    </div>
  )
}
