import { ROLE_LABELS } from "@/lib/champions"
import { sideName } from "@/lib/chaos/rules"
import type { ChaosDecreeEntry, DecreeChange, DecreeSeat } from "@/lib/chaos/types"
import type { Side } from "@/lib/types"

export function sideLabel(side: Side | null | undefined): string {
  return side ? `${sideName(side)} side` : "a side"
}

export function seatLabel(seat: Pick<DecreeSeat, "lane" | "champion">): string {
  return `${ROLE_LABELS[seat.lane] ?? seat.lane} ${seat.champion}`
}

function changes(entry: ChaosDecreeEntry): DecreeChange[] {
  return entry.details?.changes ?? []
}

function team(entry: ChaosDecreeEntry): Side | null {
  return entry.target_team ?? entry.details?.side ?? entry.side
}

export function decreeTargetName(entry: ChaosDecreeEntry): string | null {
  switch (entry.action_type) {
    case "double_or_nothing":
      return sideLabel(entry.side)
    case "royal_pardon":
    case "champion_ban":
    case "target_reroll":
      return entry.target_player_name
    case "swap_teammate":
      return entry.target_player_2_name
    case "lane_force":
      return [entry.target_player_name, entry.target_player_2_name].filter(Boolean).join(" & ") || null
    case "shuffle_lanes":
    case "reroll_champs":
      return sideLabel(team(entry))
    default:
      return null
  }
}

export function decreeHeadline(entry: ChaosDecreeEntry): string {
  const [first, second] = changes(entry)
  const target = entry.target_player_name ?? "Someone"
  switch (entry.action_type) {
    case "double_or_nothing":
      return `${entry.cost} riding on ${sideLabel(entry.side)}.`
    case "royal_pardon":
      return `${target} is under royal protection for the rest of the game.`
    case "reroll_self":
      return first
        ? `${first.player_name ?? entry.actor_name}'s ${first.before.champion} is out. ${first.after.champion} is in.`
        : `${entry.actor_name} demanded a fresh champion.`
    case "champion_ban": {
      const banned = entry.banned_champion ?? first?.before.champion ?? "champion"
      return first
        ? `${target}'s ${banned} was exiled. ${first.after.champion} answers the summons.`
        : `${target}'s ${banned} was exiled.`
    }
    case "swap_teammate":
      return first
        ? `${first.player_name ?? entry.actor_name} took ${entry.target_player_2_name ?? "a teammate"}'s seat: ${seatLabel(first.after)}.`
        : `${entry.actor_name} traded seats with ${entry.target_player_2_name ?? "a teammate"}.`
    case "lane_force":
      return first && second
        ? `${first.player_name} marches ${ROLE_LABELS[first.after.lane]}, ${second.player_name} marches ${ROLE_LABELS[second.after.lane]}. Champions stay.`
        : `${entry.target_player_name ?? "Two players"} and ${entry.target_player_2_name ?? "a teammate"} were marched into each other's lanes.`
    case "shuffle_lanes":
      return `Nobody on ${sideLabel(team(entry))} keeps their seat.`
    case "reroll_champs": {
      const count = changes(entry).length
      return count > 0
        ? `${count} new champion${count === 1 ? "" : "s"} on ${sideLabel(team(entry))}.`
        : `Every champion on ${sideLabel(team(entry))} was rerolled.`
    }
    case "target_reroll":
      return `${target}'s champion was rerolled.`
    default:
      return "A royal decree was issued."
  }
}

export interface ChangeLine {
  key: string
  player: string
  side: Side
  from: string
  to: string
}

export function changeLines(entry: ChaosDecreeEntry): ChangeLine[] {
  return changes(entry).map((c) => {
    const laneMoved = c.before.lane !== c.after.lane
    const champMoved = c.before.champion !== c.after.champion
    return {
      key: c.assignment_id,
      player: c.player_name ?? "Unknown",
      side: c.side,
      from: laneMoved && champMoved ? seatLabel(c.before) : laneMoved ? ROLE_LABELS[c.before.lane] : c.before.champion,
      to: laneMoved && champMoved ? seatLabel(c.after) : laneMoved ? ROLE_LABELS[c.after.lane] : c.after.champion,
    }
  })
}

export function decreeToast(entry: ChaosDecreeEntry): { title: string; description: string } {
  const [first] = changes(entry)
  switch (entry.action_type) {
    case "double_or_nothing":
      return {
        title: "Wager sealed",
        description:
          entry.rules_version >= 2
            ? `${entry.cost} on ${sideLabel(entry.side)}. Pays ${entry.cost * 2}, more if they survive the chaos.`
            : `${entry.cost} on ${sideLabel(entry.side)}. Pays ${entry.cost * 2} if they win.`,
      }
    case "royal_pardon":
      return { title: "Pardon granted", description: `${entry.target_player_name ?? "Your pick"} is untouchable this game.` }
    case "reroll_self":
      return {
        title: "Royal makeover",
        description: first ? `${first.before.champion} out, ${first.after.champion} in.` : "A fresh champion answers.",
      }
    case "swap_teammate":
      return {
        title: "Seat usurped",
        description: first ? `You are now ${seatLabel(first.after)}.` : "Seats traded.",
      }
    default:
      return { title: "Decree sealed", description: decreeHeadline(entry) }
  }
}
