import type { LiveEvent, LiveEventPayloads } from "@/lib/live/events"
import type { Narration } from "@/lib/live/narration"
import { actorName, count, display, listNames, lookup, pickText, plural, pts, say, sideName, text, type LineTemplate } from "@/lib/lore/herald/kit"
import { isSalaxe, mentionsSalaxe } from "@/lib/lore/salaxe"

const BET_LINES: Record<"allIn" | "raised" | "whale" | "early" | "plain", LineTemplate[]> = {
  allIn: [
    { title: "{who} went all-in on {side}", description: "{total} points, the entire purse. The notebook is holding its breath." },
    { title: "ALL-IN: {who} on {side}", description: "{total} points, no insurance, no regrets. Yet." },
    { title: "{who} shoved the whole stack on {side}", description: "{total} points riding on one Nexus. Legend or lesson, soon." },
  ],
  raised: [
    { title: "{who} raised to {total} on {side}", description: "+{amount} more. Conviction or tilt, the court cannot tell." },
    { title: "{who} doubled down on {side}", description: "Now {total} deep. The bookmaker nods slowly." },
    { title: "{who} added {amount} on {side}", description: "Total stake: {total}. Confidence is a renewable resource." },
  ],
  whale: [
    { title: "{who} dropped {amount} on {side}", description: "A whale surfaces. The odds just moved." },
    { title: "Big money: {who} backs {side} with {amount}", description: "The pool shivers. The other side starts sweating." },
    { title: "{who} bet {amount} on {side}", description: "That is not a bet, that is a statement." },
  ],
  early: [
    { title: "{who} called it early: {amount} on {side}", description: "The early conviction bonus is in play. Brave, or uninformed." },
    { title: "First in: {who}, {amount} on {side}", description: "Bet before the crowd, profit a little more. If right." },
    { title: "{who} bet {amount} on {side} before anyone blinked", description: "Early conviction pays. Being wrong early pays nothing." },
  ],
  plain: [
    { title: "{who} bet {amount} on {side}", description: "Into the notebook it goes." },
    { title: "{who} backs {side} with {amount}", description: "The pool grows. So does the tension." },
    { title: "{amount} on {side} from {who}", description: "Another soul on the line." },
    { title: "{who} put {amount} on {side}", description: "Faith, in point form." },
  ],
}

const SALAXE_BETS: LineTemplate[] = [
  { title: "Salaxe bet {amount} on {side}", description: "Historically, a strong signal to bet the other way." },
  { title: "The exiled King backs {side} with {amount}", description: "He says it is a sure thing. He said that about Baron." },
  { title: "Salaxe put {amount} on {side}", description: "The rebels are already lining up on the other side." },
]

const INSURED_NOTES = [
  "Guardian Angel included. Hope, with a refund policy.",
  "Insured. The angel hovers nearby, judging.",
  "Covered by a Guardian Angel. Caution, professionally done.",
]

export function narrateBetPlaced(event: LiveEvent): Narration | null {
  const d = event.data as LiveEventPayloads["bet.placed"]
  const who = actorName(event)
  const amount = count(d.amount)
  if (amount <= 0 || (d.side !== "blue" && d.side !== "red")) return null
  const total = count(d.total) || amount
  const values = { who, amount: pts(amount), total: pts(total), side: sideName(d.side) }
  const kind = d.allIn ? "allIn" : d.raised ? "raised" : d.whale ? "whale" : d.early ? "early" : "plain"

  if (isSalaxe(who)) {
    if (d.allIn) {
      return say(event, "bet-slx-allin", [
        { title: "Salaxe went all-in on {side}", description: "{total} points. Après moi, le déluge." },
        { title: "The exiled King shoved everything on {side}", description: "{total} points and the remains of his dignity." },
      ], values, "hype")
    }
    return say(event, "bet-slx", SALAXE_BETS, values, d.whale ? "hype" : "royal")
  }

  const line = say(event, `bet-${kind}`, BET_LINES[kind], values, kind === "allIn" || kind === "whale" ? "hype" : "info")
  if (d.insured && kind !== "allIn" && kind !== "raised") line.description = pickText(event, "bet-insured", INSURED_NOTES)
  return line
}

export function narrateBetInsured(event: LiveEvent): Narration | null {
  const d = event.data as LiveEventPayloads["bet.insured"]
  if (count(d.amount) <= 0) return null
  return say(event, "insured", [
    { title: "{who} bought a Guardian Angel", description: "{premium} points to cover {amount} on {side}. Hope is not a strategy, insurance is." },
    { title: "{who} insured their bet on {side}", description: "{premium} points paid. If it goes wrong, the angel catches part of the fall." },
    { title: "Guardian Angel for {who}", description: "{amount} on {side}, now with a safety net. Wisdom, or fear." },
  ], { who: actorName(event), premium: pts(count(d.premium)), amount: pts(count(d.amount)), side: sideName(d.side) }, "info")
}

export function narrateBetResolved(event: LiveEvent): Narration | null {
  const d = event.data as LiveEventPayloads["bet.resolved"]
  const side = sideName(d.winner)
  const pool = pts(count(d.totalPool))
  if (d.refunded) {
    return say(event, "bets-refund", [
      { title: "Bets refunded", description: "Nobody took the other side. Every stake went home." },
      { title: "The book closes with no winners", description: "One-sided market. Stakes and premiums returned." },
    ], { side, pool }, "info")
  }
  const winner = d.topWinner && display(d.topWinner.name)
  if (!winner || !d.topWinner) {
    return { title: `${side} side bets settled`, description: `${pool} points changed hands.`, tone: "info" }
  }
  const payout = count(d.topWinner.payout)
  const profit = count(d.topWinner.profit ?? payout)
  const line = say(event, "bets-top", [
    { title: "{winner} cashed {payout} on {side}" },
    { title: "{winner} wins the betting: +{profit}" },
    { title: "Payday for {winner}: {payout} points" },
    { title: "{winner} read the game. +{profit}" },
  ], { winner, payout: pts(payout), profit: pts(profit), side }, "hype")

  const allIn = (Array.isArray(d.allInLosers) ? d.allInLosers : []).map(display).filter((n): n is string => !!n)
  const loser = d.biggestLoser && display(d.biggestLoser.name)
  const notes = [
    allIn.length > 0
      ? pickText(event, "bets-allin", [
          "{names} went all-in and lost it all.",
          "All-in, all gone: {names}.",
        ], { names: listNames(allIn, 2) })
      : null,
    loser && d.biggestLoser && !allIn.includes(loser) ? `${loser} lost ${pts(count(d.biggestLoser.loss))}.` : null,
    count(d.insurancePaid) > 0 ? `Guardian Angels paid ${pts(count(d.insurancePaid))}.` : null,
  ].filter((n): n is string => !!n)
  line.description =
    notes.slice(0, 2).join(" ") ||
    `${plural(count(d.bettors), "bettor", "bettors")}, ${pool} points in the pool.`
  return line
}

export function narrateProphecyPlaced(event: LiveEvent): Narration {
  const d = event.data as LiveEventPayloads["sidebet.placed"]
  const label = text(d.label) ?? "a prophecy"
  const values = { who: actorName(event), label, amount: pts(count(d.amount)) }
  const inter = d.market === "inter"
  if (mentionsSalaxe(label.replace(/ (for MVP|to int)$/i, ""))) {
    return inter
      ? say(event, "seal-slx-inter", [
          { title: "{who} bets {amount} that Salaxe ints", description: "Rebel detected. The notebook moves them to the other column." },
          { title: "{who} prophesied Salaxe to int", description: "{amount} points of pure treason." },
        ], values, "roast")
      : say(event, "seal-slx-mvp", [
          { title: "{who} bets {amount} on Salaxe for MVP", description: "Loyalist detected. The notebook moves them to the good column." },
          { title: "{who} prophesied a Salaxe crown", description: "{amount} points on the return of the King. Bold." },
        ], values, "royal")
  }
  return inter
    ? say(event, "seal-inter", [
        { title: "{who} sealed a doom prophecy", description: "{label}, {amount} points. Brutal. Possibly accurate." },
        { title: "{who} smells feeding", description: "{label}. {amount} points say the Tribunal agrees." },
        { title: "{who} prophesied {label}", description: "{amount} points on someone's gray screen." },
      ], values, "info")
    : say(event, "seal-mvp", [
        { title: "{who} prophesied {label}", description: "{amount} points on the Tribunal's crown." },
        { title: "{who} sealed a crown prophecy", description: "{label}, {amount} points. The court will decide." },
        { title: "{who} sees a crown in the stars", description: "{label}. Sealed for {amount}." },
      ], values, "info")
}

export function narrateProphecyResolved(event: LiveEvent): Narration {
  const d = event.data as LiveEventPayloads["sidebet.resolved"]
  const winners = count(d.winners)
  const values = { label: d.label, winners: plural(winners, "prophet", "prophets"), payout: pts(count(d.payout)) }
  return winners > 0
    ? say(event, "prophecy-won", [
        { title: "{label} settled", description: "{winners} split {payout} points. The stars were right." },
        { title: "The prophets were right", description: "{label}: {winners} paid, {payout} points in total." },
      ], values, "hype")
    : say(event, "prophecy-none", [
        { title: "{label}: nobody saw it coming", description: "No prophet called it. Every stake goes home." },
        { title: "The stars lied", description: "{label} found no winner. Stakes returned." },
      ], values, "info")
}

const ROUTINE_REASONS = new Set([
  "daily_bonus",
  "initial_grant",
  "game_win",
  "game_participation",
  "kiss_the_hand",
  "sing_his_praises",
  "riddle_bonus",
  "mvp_bonus",
])
const ROUTINE_PREFIXES = ["bet_", "chaos_", "insurance_", "prophecy_", "title_", "bounty_", "sabotage_", "shame_", "duel_"]

const REASON_LABELS: Record<string, string> = {
  act_carryover: "Act rewards",
  admin_adjustment: "A royal adjustment",
  admin_grant: "A royal grant",
}

function reasonLabel(reason: string): string {
  const label = lookup(REASON_LABELS, reason)
  if (label) return label
  const words = reason.replace(/_/g, " ").trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Royal accounting"
}

// Balance moves already have their own story elsewhere; only rare, large, attributed swings get a line.
export function narratePoints(event: LiveEvent): Narration | null {
  const d = event.data as LiveEventPayloads["points.changed"]
  const delta = count(d.delta)
  const reason = text(d.reason) ?? ""
  if (!event.actor || Math.abs(delta) < 100) return null
  if (ROUTINE_REASONS.has(reason) || ROUTINE_PREFIXES.some((p) => reason.startsWith(p))) return null
  const values = { who: actorName(event), amount: pts(Math.abs(delta)), reason: reasonLabel(reason) }
  return delta > 0
    ? say(event, "points-up", [
        { title: "{who} gained {amount} points", description: "{reason}. The treasury groans." },
        { title: "+{amount} for {who}", description: "{reason}. The leaderboard shifts." },
      ], values, "hype")
    : say(event, "points-down", [
        { title: "{who} lost {amount} points", description: "{reason}. The notebook takes note." },
        { title: "-{amount} for {who}", description: "{reason}. A moment of silence for the purse." },
      ], values, "roast")
}
