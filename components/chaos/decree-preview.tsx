"use client"

import { ArrowRightIcon } from "lucide-react"
import { ROLE_LABELS } from "@/lib/champions"
import { WAGER_DEFIANCE_STEP, type DecreeType } from "@/lib/chaos/catalog"
import { seatLabel } from "@/lib/chaos/format"
import { pardonedPlayerIds, ruleFor, sideName, viewerSeat, type DecreeContext } from "@/lib/chaos/rules"
import type { BoardAssignment } from "@/lib/chaos/types"
import { NO_EFFECTS, wagerBaseMultiplier, wagerTopMultiplier } from "@/lib/titles/effects"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"
import { SIDE_STYLES } from "@/components/chaos/tier-styles"

export interface DecreeSelection {
  side: Side | null
  seats: string[]
}

interface PreviewLine {
  key: string
  who: string
  side: Side
  from: string
  to: string
}

interface Preview {
  summary: string
  lines: PreviewLine[]
}

function line(seat: BoardAssignment, who: string, from: string, to: string): PreviewLine {
  return { key: `${seat.id}-${who}`, who, side: seat.side, from, to }
}

// Integer math on hundredths: 49 x 2.2 must floor to 107 like the database, not 107.80000000000001.
function payoutAt(stake: number, multiplier: number): number {
  return Math.floor((stake * Math.round(multiplier * 100)) / 100)
}

export function buildPreview(type: DecreeType, selection: DecreeSelection, ctx: DecreeContext): Preview | null {
  const seats = selection.seats
    .map((id) => ctx.assignments.find((a) => a.id === id))
    .filter((s): s is BoardAssignment => !!s)
  const mine = viewerSeat(ctx)
  const pardoned = pardonedPlayerIds(ctx.actions)
  const cost = ruleFor(type, ctx.rules).cost

  switch (type) {
    case "double_or_nothing": {
      if (!selection.side) return null
      const start = ctx.schema === "v2" ? wagerBaseMultiplier(ctx.titles?.actor ?? NO_EFFECTS) : wagerBaseMultiplier(NO_EFFECTS)
      const base = payoutAt(cost, start)
      const top = wagerTopMultiplier(start)
      const max = payoutAt(cost, top)
      return {
        summary:
          ctx.schema === "v2"
            ? `If ${sideName(selection.side)} wins you collect ${base} (x${start}). Defiance pays: a hostile decree someone lands on ${sideName(selection.side)} after this adds +${WAGER_DEFIANCE_STEP}x, up to ${max} (${top}x).`
            : `If ${sideName(selection.side)} wins you collect ${base}. If they lose, the treasury keeps your ${cost}.`,
        lines: [],
      }
    }
    case "royal_pardon": {
      const [seat] = seats
      if (!seat) return null
      return {
        summary: `${seat.name} becomes untouchable for the rest of this game.`,
        lines: [line(seat, seat.name, seatLabel(seat), "Protected")],
      }
    }
    case "reroll_self": {
      if (!mine) return null
      return {
        summary: "A random new champion for your lane. Never your current one, never one already in this game.",
        lines: [line(mine, "You", mine.champion, `New ${ROLE_LABELS[mine.lane]} champion`)],
      }
    }
    case "champion_ban": {
      const [seat] = seats
      if (!seat) return null
      return {
        summary: `${seat.champion} is exiled for the rest of this game. ${seat.name} rolls a new ${ROLE_LABELS[seat.lane]} champion.`,
        lines: [line(seat, seat.name, seat.champion, `New ${ROLE_LABELS[seat.lane]} champion`)],
      }
    }
    case "swap_teammate": {
      const [seat] = seats
      if (!seat || !mine) return null
      return {
        summary: `You and ${seat.name} trade lanes and champions.`,
        lines: [line(mine, "You", seatLabel(mine), seatLabel(seat)), line(seat, seat.name, seatLabel(seat), seatLabel(mine))],
      }
    }
    case "lane_force": {
      const [a, b] = seats
      if (!a || !b) return null
      return {
        summary: "They trade lanes and keep their champions.",
        lines: [
          line(a, a.name, ROLE_LABELS[a.lane], `${ROLE_LABELS[b.lane]} on ${a.champion}`),
          line(b, b.name, ROLE_LABELS[b.lane], `${ROLE_LABELS[a.lane]} on ${b.champion}`),
        ],
      }
    }
    case "shuffle_lanes":
    case "reroll_champs": {
      if (!selection.side) return null
      const team = ctx.assignments.filter((a) => a.side === selection.side)
      const moving = team.filter((a) => !pardoned.has(a.player_id))
      const spared = team.length - moving.length
      const shuffle = type === "shuffle_lanes"
      const tail = spared > 0 ? ` ${spared} pardoned player${spared === 1 ? " stays" : "s stay"} put.` : ""
      return {
        summary: shuffle
          ? `${moving.length} players on ${sideName(selection.side)} trade seats. Nobody keeps their own.${tail}`
          : `${moving.length} champions on ${sideName(selection.side)} are rerolled. No repeats.${tail}`,
        lines: moving.map((seat) =>
          shuffle
            ? line(seat, seat.name, seatLabel(seat), "Another seat")
            : line(seat, seat.name, seat.champion, `New ${ROLE_LABELS[seat.lane]} champion`)
        ),
      }
    }
    default:
      return null
  }
}

export function DecreePreview({ preview }: { preview: Preview | null }) {
  if (!preview) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--color-gold)]/15 p-3 text-center text-xs text-[var(--color-gold-light)]/50">
        Choose a target to preview the decree.
      </div>
    )
  }
  return (
    <section aria-label="Decree preview" className="rounded-lg border border-[var(--color-gold)]/15 bg-[var(--color-navy)]/70 p-3">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]/70">
        What happens
      </div>
      <p className="text-sm leading-snug text-[var(--color-gold-light)]/85">{preview.summary}</p>
      {preview.lines.length > 0 && (
        <ul className="mt-2 space-y-1">
          {preview.lines.map((l) => (
            <li key={l.key} className="flex flex-wrap items-center gap-x-1.5 text-xs">
              <span className={cn("font-semibold", SIDE_STYLES[l.side].text)}>{l.who}</span>
              <span className="text-[var(--color-gold-light)]/60">{l.from}</span>
              <ArrowRightIcon aria-label="becomes" className="size-3 text-[var(--color-gold)]/70" />
              <span className="text-[var(--color-gold-light)]">{l.to}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
