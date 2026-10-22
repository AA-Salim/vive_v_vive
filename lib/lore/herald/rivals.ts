import type { LiveEvent, LiveEventPayloads } from "@/lib/live/events"
import type { Narration } from "@/lib/live/narration"
import { actorName, count, display, plural, pts, say, sideName } from "@/lib/lore/herald/kit"
import { isSalaxe } from "@/lib/lore/salaxe"

export function narrateDuel(event: LiveEvent): Narration | null {
  switch (event.type) {
    case "duel.challenged": {
      const d = event.data as LiveEventPayloads["duel.challenged"]
      const challenger = display(d.challengerName)
      const opponent = display(d.opponentName)
      if (!challenger) return null
      const values = { challenger, opponent: opponent ?? "", amount: pts(count(d.amount)), side: sideName(d.side) }
      if (!opponent) {
        return say(event, "duel-open", [
          { title: "{challenger} issued an open duel", description: "{amount} points on {side}. First taker gets the other side." },
          { title: "Open challenge from {challenger}", description: "{amount} points says {side} wins. Any takers?" },
          { title: "{challenger} wants a duel, any duel", description: "{amount} on {side}. The court waits for a brave fool." },
        ], values, "hype")
      }
      if (isSalaxe(opponent)) {
        return say(event, "duel-slx", [
          { title: "{challenger} challenged Salaxe to a duel", description: "{amount} points. Treason, with paperwork." },
          { title: "{challenger} slapped the exiled King with a glove", description: "A {amount}-point duel. The notebook trembles." },
        ], values, "danger")
      }
      return say(event, "duel-named", [
        { title: "{challenger} challenged {opponent} to a duel", description: "{amount} points, {challenger} backs {side}. Accept or be remembered." },
        { title: "Gauntlet thrown: {challenger} vs {opponent}", description: "{amount} on the line, {challenger} takes {side}." },
        { title: "{challenger} calls out {opponent}", description: "A {amount}-point duel. {side} for the challenger, glory for the brave." },
      ], values, "danger")
    }
    case "duel.accepted": {
      const d = event.data as LiveEventPayloads["duel.accepted"]
      const challenger = display(d.challengerName)
      const opponent = display(d.opponentName)
      if (!challenger || !opponent) return null
      return say(event, "duel-accepted", [
        { title: "{opponent} accepted {challenger}'s duel", description: "{amount} points on the line. Only one leaves richer." },
        { title: "Duel on: {challenger} vs {opponent}", description: "{amount} points. The Nexus will judge." },
        { title: "{opponent} took the bait", description: "{challenger}'s {amount}-point duel is live." },
      ], { challenger, opponent, amount: pts(count(d.amount)) }, "hype")
    }
    case "duel.declined": {
      const d = event.data as LiveEventPayloads["duel.declined"]
      const challenger = display(d.challengerName)
      const opponent = display(d.opponentName)
      if (!challenger || !opponent) return null
      return say(event, "duel-declined", [
        { title: "{opponent} declined {challenger}'s duel", description: "Cowardice or financial literacy. The court is split." },
        { title: "{opponent} said no to {challenger}", description: "The gauntlet stays on the floor, next to the crown." },
        { title: "Duel refused", description: "{opponent} will not fight {challenger}. Today." },
      ], { challenger, opponent }, "roast")
    }
    case "duel.resolved": {
      const d = event.data as LiveEventPayloads["duel.resolved"]
      const winner = display(d.winnerName)
      const loser = display(d.loserName)
      if (!winner || !loser) return null
      return say(event, "duel-resolved", [
        { title: "{winner} won the duel against {loser}", description: "+{amount}. {loser} will be asking for a rematch." },
        { title: "{winner} beats {loser}", description: "{amount} points change hands. So does pride." },
        { title: "Duel settled: {winner} over {loser}", description: "The notebook records the winner. And, in bold, the loser." },
      ], { winner, loser, amount: pts(count(d.amount)) }, "hype")
    }
    default:
      return null
  }
}

export function narrateBounty(event: LiveEvent): Narration | null {
  if (event.type === "bounty.placed") {
    const d = event.data as LiveEventPayloads["bounty.placed"]
    const target = display(d.targetName)
    if (!target) return null
    const values = { who: actorName(event), target, amount: pts(count(d.amount)) }
    if (isSalaxe(target)) {
      return say(event, "bounty-slx", [
        { title: "{who} put a bounty on Salaxe", description: "{amount} points. Regicide, with a reward program." },
        { title: "Wanted: the exiled King", description: "{who} offers {amount} points for a Salaxe defeat. Delayed or otherwise." },
      ], values, "danger")
    }
    return say(event, "bounty-placed", [
      { title: "{who} put a {amount}-point bounty on {target}", description: "Make them lose and the hunters get paid." },
      { title: "Wanted: {target}", description: "{amount} points from {who} for the loss. Preferably a painful one." },
      { title: "{who} wants {target} to lose", description: "{amount} points say the Rift agrees." },
    ], values, "danger")
  }
  if (event.type === "bounty.claimed") {
    const d = event.data as LiveEventPayloads["bounty.claimed"]
    const target = display(d.targetName)
    if (!target) return null
    const hunters = count(d.hunters)
    return say(event, "bounty-claimed", [
      { title: "The bounty on {target} was collected", description: "{target} lost. {amount} points paid to {hunters}." },
      { title: "{target} fell, the hunters feast", description: "{amount} points paid out. Nothing personal. Mostly." },
      { title: "Bounty claimed: {target}", description: "The price on their head has been paid in full." },
    ], { target, amount: pts(count(d.amount)), hunters: plural(Math.max(hunters, 1), "hunter", "hunters") }, "danger")
  }
  return null
}
