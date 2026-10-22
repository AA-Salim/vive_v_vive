"use client"

import { useState } from "react"
import { CoinsIcon, HourglassIcon, LoaderCircleIcon, TriangleAlertIcon } from "lucide-react"
import { DEBT_FLOOR, getDecree, TIER_LABELS, type DecreeType } from "@/lib/chaos/catalog"
import {
  decreeBlock,
  pardonedPlayerIds,
  playerBlock,
  shortfall,
  sideBlock,
  viewerSeat,
  type DecreeBlock,
  type DecreeContext,
} from "@/lib/chaos/rules"
import type { DecreeRequest } from "@/lib/chaos/schema"
import { seatExileImmune, type DecreeAim } from "@/lib/chaos/title-terms"
import type { BoardAssignment } from "@/lib/chaos/types"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { InfoTip } from "@/components/ui/info-tip"
import { Input } from "@/components/ui/input"
import { decreeHelp } from "@/components/chaos/help"
import { DecreeIcon } from "@/components/chaos/decree-icon"
import { buildPreview, DecreePreview, type DecreeSelection } from "@/components/chaos/decree-preview"
import { PlayerChoice, SideChoice, type PlayerOption, type SideOption } from "@/components/chaos/target-pickers"
import { chipsHelp, TitleChipRow } from "@/components/chaos/title-chips"
import { decreeDialogPrice, seatTitleChips, sideTitleChips } from "@/components/chaos/title-view"
import { TIER_STYLES } from "@/components/chaos/tier-styles"
import { formatClock } from "@/components/chaos/use-now"

interface DecreeDialogProps {
  type: DecreeType | null
  open: boolean
  ctx: DecreeContext
  remainingMs: number | null
  pending: boolean
  error: string | null
  pledgePhrase: string
  onOpenChange: (open: boolean) => void
  onSubmit: (request: DecreeRequest) => void
}

function seatById(ctx: DecreeContext, id: string | undefined): BoardAssignment | null {
  return ctx.assignments.find((a) => a.id === id) ?? null
}

function buildRequest(type: DecreeType, selection: DecreeSelection, ctx: DecreeContext): DecreeRequest | null {
  const [first, second] = selection.seats.map((id) => seatById(ctx, id))
  switch (type) {
    case "double_or_nothing":
      return selection.side ? { action_type: type, side: selection.side } : null
    case "reroll_self":
      return { action_type: type }
    case "royal_pardon":
    case "champion_ban":
    case "swap_teammate":
      return first ? { action_type: type, target_player_id: first.player_id } : null
    case "lane_force":
      return first && second
        ? { action_type: type, target_player_id: first.player_id, target_player_2_id: second.player_id }
        : null
    case "shuffle_lanes":
    case "reroll_champs":
      return selection.side ? { action_type: type, target_team: selection.side } : null
    default:
      return null
  }
}

function selectionBlock(type: DecreeType, selection: DecreeSelection, ctx: DecreeContext): string | null {
  const def = getDecree(type)
  if (!def) return "Unknown decree"
  if (def.targeting === "side" || def.targeting === "team") {
    return selection.side ? sideBlock(type, selection.side, ctx) : null
  }
  const [first, second] = selection.seats.map((id) => seatById(ctx, id))
  if (first && playerBlock(type, first, ctx, second)) return playerBlock(type, first, ctx, second)
  if (second && playerBlock(type, second, ctx, first)) return playerBlock(type, second, ctx, first)
  return null
}

function sideOptions(type: DecreeType, ctx: DecreeContext): SideOption[] {
  const pardoned = pardonedPlayerIds(ctx.actions)
  return (["blue", "red"] as Side[]).map((side) => {
    const team = ctx.assignments.filter((a) => a.side === side)
    const open = team.filter((a) => !pardoned.has(a.player_id)).length
    const hint =
      type === "double_or_nothing"
        ? team.map((a) => a.name).join(", ")
        : `${open} of ${team.length} seats unpardoned`
    return { side, block: sideBlock(type, side, ctx), hint, chips: sideTitleChips(type, side, ctx) }
  })
}

function playerOptions(type: DecreeType, selection: DecreeSelection, ctx: DecreeContext): PlayerOption[] {
  const pardoned = pardonedPlayerIds(ctx.actions)
  const mine = viewerSeat(ctx)
  const [first] = selection.seats.map((id) => seatById(ctx, id))
  return ctx.assignments
    .filter((seat) => type !== "swap_teammate" || (mine && seat.side === mine.side && seat.id !== mine.id))
    .map((seat) => ({
      seat,
      pardoned: pardoned.has(seat.player_id),
      block: playerBlock(type, seat, ctx, type === "lane_force" && first && first.id !== seat.id ? first : null),
      immune: type === "champion_ban" && seatExileImmune(seat, ctx.titles),
      chips: seatTitleChips(type, seat, ctx),
    }))
}

function aimOf(type: DecreeType, selection: DecreeSelection, ctx: DecreeContext): DecreeAim {
  const [first, second] = selection.seats.map((id) => seatById(ctx, id))
  const def = getDecree(type)
  return {
    first: first?.player_id ?? null,
    second: second?.player_id ?? null,
    team: def?.targeting === "team" ? selection.side : null,
  }
}

// The card checks funds at the caster's own price; a discount on the chosen target can make it affordable.
function exactBlock(block: DecreeBlock | null, missing: number): DecreeBlock | null {
  if (block?.code !== "funds") return block
  return missing > 0 ? { code: "funds", label: `Need ${missing} more` } : null
}

function initialSelection(type: DecreeType | null, ctx: DecreeContext): DecreeSelection {
  const mine = viewerSeat(ctx)
  if (type === "double_or_nothing" && mine) return { side: mine.side, seats: [] }
  return { side: null, seats: [] }
}

export function DecreeDialog({
  type,
  open,
  ctx,
  remainingMs,
  pending,
  error,
  pledgePhrase,
  onOpenChange,
  onSubmit,
}: DecreeDialogProps) {
  const [selection, setSelection] = useState<DecreeSelection>(() => initialSelection(type, ctx))
  const [pledge, setPledge] = useState("")
  const def = type ? getDecree(type) : undefined
  if (!type || !def) return null

  const style = TIER_STYLES[def.tier]
  const price = decreeDialogPrice(type, ctx, aimOf(type, selection, ctx))
  const cost = price.cost
  const repriced = cost !== price.base
  const balance = ctx.viewer?.balance ?? null
  const after = balance == null ? null : balance - cost
  const block = exactBlock(decreeBlock(type, ctx), shortfall(type, ctx, cost))
  const targetBlock = selectionBlock(type, selection, ctx)
  const request = buildRequest(type, selection, ctx)
  const needsPledge = balance != null && balance < 0
  const pledged = !needsPledge || pledge.trim().toLowerCase() === pledgePhrase.toLowerCase()
  const closed = remainingMs !== null && remainingMs <= 0
  const canSeal = !!request && !block && !targetBlock && pledged && !pending && !closed
  const help = decreeHelp(type, ctx)

  const toggleSeat = (id: string) => {
    setSelection((prev) => {
      if (def.targeting === "two_teammates") {
        if (prev.seats.includes(id)) return { ...prev, seats: prev.seats.filter((s) => s !== id) }
        return { ...prev, seats: prev.seats.length < 2 ? [...prev.seats, id] : [prev.seats[0], id] }
      }
      return { ...prev, seats: prev.seats[0] === id ? [] : [id] }
    })
  }

  const pickerLabel =
    def.targeting === "two_teammates"
      ? "Pick two players on the same team"
      : def.targeting === "teammate"
        ? "Pick a teammate"
        : "Pick a player"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-4 overflow-y-auto border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)] sm:max-w-lg">
        <DialogHeader className="gap-3 pr-6">
          <div className="flex items-center gap-3">
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-xl border bg-[var(--color-navy)]",
                style.border,
                style.text
              )}
            >
              <DecreeIcon type={type} className="size-5" />
            </span>
            <div className="min-w-0">
              <span className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", style.text)}>
                {TIER_LABELS[def.tier]} · Royal decree
              </span>
              <DialogTitle className="font-display text-xl font-semibold text-[var(--color-gold-light)]">
                {def.name}
              </DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-sm leading-relaxed text-[var(--color-gold-light)]/70">
            {ctx.schema === "v2" ? def.effect : (def.legacyEffect ?? def.effect)}
          </DialogDescription>
          <p className="border-l-2 border-[var(--color-gold)]/30 pl-3 text-xs italic text-[var(--color-gold-light)]/50">
            {def.flavor}
          </p>
        </DialogHeader>

        {(def.targeting === "side" || def.targeting === "team") && (
          <SideChoice
            label={def.targeting === "side" ? "Choose the side to back" : "Choose the team to strike"}
            value={selection.side}
            options={sideOptions(type, ctx)}
            onChange={(side) => setSelection({ side, seats: [] })}
          />
        )}

        {(def.targeting === "player" || def.targeting === "teammate" || def.targeting === "two_teammates") && (
          <PlayerChoice
            label={pickerLabel}
            mode={def.targeting === "two_teammates" ? "pair" : "single"}
            selected={selection.seats}
            options={playerOptions(type, selection, ctx)}
            viewerPlayerId={ctx.viewer?.playerId ?? null}
            onToggle={toggleSeat}
          />
        )}

        <DecreePreview preview={buildPreview(type, selection, ctx)} />

        {price.chips.length > 0 && (
          <div className="space-y-1.5 rounded-lg border border-emerald-400/20 bg-emerald-400/[0.05] p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200/80">Your titles on this decree</p>
            <TitleChipRow
              chips={price.chips}
              help={chipsHelp(def.name, "These titles changed what this decree costs or pays.", price.chips)}
            />
          </div>
        )}

        {needsPledge && (
          <div className="space-y-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
            <p className="text-xs text-amber-200/90">
              You are in debt ({balance} pts). To keep spending, pledge your allegiance. Type exactly:
            </p>
            <p className="font-display text-sm font-semibold text-[var(--color-gold)]">&ldquo;{pledgePhrase}&rdquo;</p>
            <Input
              value={pledge}
              onChange={(e) => setPledge(e.target.value)}
              placeholder="Type the pledge"
              aria-label="Debt pledge"
              className="h-10 bg-[var(--color-navy)]"
            />
          </div>
        )}

        {(error || targetBlock || (block && block.code !== "funds")) && (
          <p role="alert" className="flex items-start gap-2 rounded-lg bg-[var(--color-red-team)]/10 p-2.5 text-xs text-red-200">
            <TriangleAlertIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            {error ?? targetBlock ?? block?.label}
          </p>
        )}

        <div className="flex flex-col gap-3 border-t border-[var(--color-gold)]/10 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5 text-xs text-[var(--color-gold-light)]/65">
            <div className="flex items-center gap-1.5">
              <CoinsIcon aria-hidden className="size-3.5 text-[var(--color-gold)]" />
              <span>
                Costs{" "}
                {repriced && (
                  <s className="text-[var(--color-gold-light)]/40">
                    <span className="sr-only">was </span>
                    {price.base}
                  </s>
                )}{" "}
                <strong className={cn(repriced ? (cost < price.base ? "text-emerald-300" : "text-rose-300") : "text-[var(--color-gold)]")}>
                  {cost}
                </strong>
                {after != null && (
                  <>
                    {" "}
                    · Purse after{" "}
                    <strong className={cn(after < 0 ? "text-amber-300" : "text-[var(--color-gold-light)]")}>{after}</strong>
                  </>
                )}
              </span>
              {help && <InfoTip help={help} align="start" className="-my-1" />}
            </div>
            {block?.code === "funds" && <div className="text-amber-300">{block.label} to stay above the {DEBT_FLOOR} debt floor.</div>}
            {remainingMs !== null && (
              <div
                className={cn(
                  "flex items-center gap-1.5",
                  remainingMs <= 10_000 ? "text-[var(--color-red-team)]" : "text-[var(--color-gold-light)]/65"
                )}
              >
                <HourglassIcon aria-hidden className="size-3.5" />
                {closed ? "The decree window has closed." : `Window closes in ${formatClock(remainingMs)}`}
              </div>
            )}
          </div>
          <Button
            onClick={() => request && onSubmit(request)}
            disabled={!canSeal}
            className={cn("h-11 min-w-[11rem] px-4 text-sm font-bold", style.solid)}
          >
            {pending ? (
              <>
                <LoaderCircleIcon aria-hidden className="size-4 animate-spin" />
                Sealing...
              </>
            ) : (
              `Seal the decree · ${cost}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
