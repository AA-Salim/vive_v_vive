import type { LiveEvent, LiveEventPayloads } from "@/lib/live/events"
import type { Narration } from "@/lib/live/narration"
import { actorName, display, laneName, lookup, pickText, roman, say, sideName, type LineTemplate } from "@/lib/lore/herald/kit"
import { isSalaxe } from "@/lib/lore/salaxe"

const CREATED: Record<string, LineTemplate[]> = {
  standard: [
    { title: "{who} opened a new game", description: "Ten souls, five lanes, one randomizer with a grudge. The draft is next." },
    { title: "{who} summoned the Charamil to the Rift", description: "Fresh teams incoming. Pray for your main, prepare for Yuumi." },
    { title: "A new game begins, by order of {who}", description: "The randomizer is warming up. Nobody is safe, least of all the jungler." },
    { title: "{who} rang the bell: ten players wanted", description: "Lanes, champions and teammates assigned by fate. Complaints go in the notebook." },
  ],
  coach_draft: [
    { title: "{who} called a Coach Draft", description: "Two coaches, ten players and a lot of feelings about pick order." },
    { title: "Coach Draft: the captains take the stage", description: "First pick, last pick, and the long silence before someone picks the Teemo main." },
    { title: "{who} handed out the clipboards", description: "The coaches pick the squads. Last pick gets sympathy. Maybe." },
  ],
  vainqueur: [
    { title: "{who} started a Vainqueur game", description: "Winners hold the Rift. Losers go back to the queue to think about what they did." },
    { title: "Vainqueur rules: the winner stays", description: "Win and keep your seat. Lose and the queue gets a new resident." },
    { title: "{who} opened the Vainqueur arena", description: "King of the hill, Rift edition. Salaxe would like it noted that he invented hills." },
  ],
}

const SALAXE_HOSTS: LineTemplate[] = [
  { title: "Salaxe opened a new game", description: "The exile has the host button. Lock your doors, unlock your champions." },
  { title: "The exiled King summons ten players", description: "He insists this is a normal custom game. The notebook is open on the table." },
  { title: "Salaxe is hosting. Act accordingly", description: "Every lane is his lane, every Baron his Baron. Allegedly." },
]

const STATUS: Record<string, LineTemplate[]> = {
  coach_draft: [
    { title: "The coaches take their seats", description: "Picks go back and forth. Every name called is a friendship tested." },
    { title: "The Coach Draft is on", description: "Watch the picks land. Being picked last builds character." },
  ],
  draft: [
    { title: "The squads are set", description: "Coach draft complete. Fate deals the lanes and champions now." },
    { title: "Teams locked, fate takes over", description: "The coaches have spoken. The randomizer speaks next." },
    { title: "The draft is on the table", description: "Lock what you love, re-roll what you fear." },
  ],
  chaos: [
    { title: "Royal Decrees are open", description: "Spend points to bend the draft. Every decree is signed, every grudge remembered." },
    { title: "The decree window is open", description: "Reroll a rival, exile a champion, march someone to the wrong lane. Legally." },
    { title: "Let the decrees begin", description: "The draft is final until someone pays to make it not final." },
    { title: "The Crown accepts petitions", description: "Your points, your grudges, your decrees. The draft is open to negotiation." },
  ],
  betting: [
    { title: "Betting is open", description: "Back a side before the window closes. Early conviction pays a little extra." },
    { title: "The bookmaker opens the notebook", description: "Blue or Red. Guardian Angel for the careful, all-in for the legends." },
    { title: "Place your bets", description: "The teams are final. Your judgment is about to be tested in public." },
    { title: "The betting window is open", description: "The odds move with every bet. So does Salaxe's left eyebrow." },
  ],
  in_game: [
    { title: "Bets are locked. The game is live", description: "No more bets, no more decrees. The Nexus decides now." },
    { title: "The gates are closed", description: "Ten players on the Rift, a whole court of armchair coaches watching." },
    { title: "Live on the Rift", description: "Bets locked. Ward your river, mute your feelings, pray for your side." },
    { title: "No more bets", description: "The notebook is sealed. Whatever happens next happens on the record." },
  ],
  win: [
    { title: "{side} side wins", description: "The Nexus falls. Payouts are landing, excuses are loading." },
    { title: "Victory for {side} side", description: "GG. Somewhere, someone is already typing jungle diff." },
    { title: "The Nexus falls to {side}", description: "Winners collect, losers recalibrate, Salaxe updates the notebook." },
    { title: "{side} side takes the game", description: "Bets settle now. The support is already being blamed in voice chat." },
    { title: "{side} side is victorious", description: "History is written by the winners. The losers get the Shame Board." },
  ],
  canceled: [
    { title: "{who} canceled the game", description: "Every bet and decree goes back to its owner. The drama stays." },
    { title: "Game called off", description: "Refunds are on the way. Grudges are not refundable." },
    { title: "The game was scrapped", description: "No winner, no loser, no excuses. Stakes returned in full." },
  ],
  expired: [
    { title: "The game expired", description: "Nobody declared a winner in time. The scribes closed the book." },
    { title: "Time ran out on the Rift", description: "The game was left unattended. The notebook files it under unsolved." },
  ],
}

const EARLY_CLOSE = [
  "{who} sealed the decrees early. Bet before the gates close.",
  "{who} cut the decrees short. The bookmaker is open for business.",
]

export function narrateCreated(event: LiveEvent): Narration {
  const d = event.data as LiveEventPayloads["session.created"]
  const who = actorName(event)
  if (isSalaxe(who) && d.mode !== "coach_draft") return say(event, "host", SALAXE_HOSTS, { who }, "hype")
  return say(event, "created", lookup(CREATED, d.mode) ?? CREATED.standard, { who }, "hype")
}

export function narrateStatus(event: LiveEvent): Narration | null {
  const d = event.data as LiveEventPayloads["session.status"]
  const who = actorName(event, "The host")
  switch (d.to) {
    case "blue_win":
    case "red_win":
      return say(event, "win", STATUS.win, { side: sideName(d.to === "blue_win" ? "blue" : "red") }, "hype")
    case "canceled": {
      const lines = event.actor ? STATUS.canceled : STATUS.canceled.slice(1)
      return say(event, "canceled", lines, { who }, "info")
    }
    case "betting": {
      const line = say(event, "betting", STATUS.betting, { who }, "hype")
      if (d.from === "chaos" && event.actor) line.description = pickText(event, "early", EARLY_CLOSE, { who })
      return line
    }
    case "draft":
      return say(event, "draft", d.from === "coach_draft" ? STATUS.draft.slice(0, 2) : STATUS.draft.slice(2), { who }, "info")
    case "chaos":
      return say(event, "chaos", STATUS.chaos, { who }, "royal")
    case "in_game":
      return say(event, "live", STATUS.in_game, { who }, "hype")
    case "coach_draft":
      return say(event, "coach", STATUS.coach_draft, { who }, "info")
    case "expired":
      return say(event, "expired", STATUS.expired, { who }, "info")
    default:
      return null
  }
}

const REROLLED: LineTemplate[] = [
  { title: "{who} re-rolled the draft" },
  { title: "{who} asked fate for a second opinion" },
  { title: "{who} shuffled the draft" },
]

export function narrateRerolled(event: LiveEvent): Narration {
  const d = event.data as LiveEventPayloads["session.rerolled"]
  const locked = Math.max(0, Number(d.lockedCount) || 0)
  const line = say(event, "reroll", REROLLED, { who: actorName(event) }, "info")
  line.description =
    locked > 0
      ? pickText(event, "reroll-kept", [
          "{n} locked {picks} survived. Everyone else gets a new destiny.",
          "{n} {picks} held firm. The rest of the lobby starts over.",
        ], { n: locked, picks: locked === 1 ? "pick" : "picks" })
      : pickText(event, "reroll-all", [
          "Nothing was locked. Fresh lanes, fresh champions, fresh complaints.",
          "No locks, no mercy. Everybody rolls again.",
          "A clean slate. Someone's dream draft just evaporated.",
        ])
  return line
}

const PICKS: LineTemplate[] = [
  { title: "{coach} drafted {player}" },
  { title: "{coach} calls {player}'s name" },
  { title: "{player} joins {coach}'s squad" },
  { title: "{coach} picks {player}" },
]

export function narrateCoachPick(event: LiveEvent): Narration | null {
  const d = event.data as LiveEventPayloads["coachdraft.pick"]
  const coach = display(d.coachName)
  const player = display(d.playerName)
  if (!coach || !player) return null
  const values = { coach, player, side: sideName(d.side), lane: laneName(d.lane) ?? "" }
  if (isSalaxe(player)) {
    return say(event, "pick-salaxe", [
      { title: "{coach} drafted Salaxe", description: "Bold. Brave. Possibly a cry for help." },
      { title: "{coach} picks the exiled King", description: "Salaxe joins {side} side. The crown is watching closely." },
    ], values, "royal")
  }
  const line = say(event, "pick", PICKS, values, "info")
  line.description = values.lane
    ? pickText(event, "pick-lane", [
        "{lane} for {side} side. The bench pretends not to care.",
        "Locked in at {lane} for {side} side.",
        "{side} side gets a {lane}. Opinions were not requested.",
      ], values)
    : pickText(event, "pick-side", [
        "Off to {side} side.",
        "{side} side grows stronger. Or at least bigger.",
        "{side} side adds a body to the roster.",
      ], values)
  return line
}

const QUEUE: Record<string, LineTemplate[]> = {
  joined: [
    { title: "{player} joined the queue", description: "Next in line for the Rift." },
    { title: "{player} took a number", description: "The queue grows. So does the patience required." },
    { title: "{player} is waiting for a seat", description: "Warming up on the bench, cracking knuckles." },
  ],
  left: [
    { title: "{player} left the queue", description: "Touching grass, allegedly." },
    { title: "{player} stepped out of line", description: "A seat opened up. Someone just moved forward." },
    { title: "{player} abandoned the queue", description: "No dodge penalty here. Only judgment." },
  ],
  cleared: [
    { title: "{who} cleared the queue", description: "Everyone back to square one." },
    { title: "The queue was wiped", description: "Fresh line, same impatience." },
  ],
  reordered: [
    { title: "{who} reshuffled the queue", description: "New order, same impatience." },
    { title: "The queue was rearranged", description: "Some moved up. Some are drafting complaints." },
  ],
  advanced: [
    { title: "The queue moved up", description: "Fresh legs head to the Rift." },
    { title: "Next up from the queue", description: "The bench empties, the Rift fills." },
  ],
}

export function narrateQueue(event: LiveEvent): Narration | null {
  const d = event.data as LiveEventPayloads["queue.changed"]
  const player = display(d.playerName)
  const lines = lookup(QUEUE, d.action)
  if (!lines) return null
  if ((d.action === "joined" || d.action === "left") && !player) return null
  return say(event, `queue-${d.action}`, lines, { player: player ?? "", who: actorName(event) }, "info")
}

const VAINQUEUR: Record<string, LineTemplate[]> = {
  activate: [
    { title: "Vainqueur rotation is on", description: "Winners hold the Rift. Losers make room." },
    { title: "{who} switched on Vainqueur", description: "Win to stay. Lose to queue. Simple, brutal, fair." },
  ],
  deactivate: [
    { title: "Vainqueur rotation is over", description: "Back to pure randomness. Everyone is equal again, for a while." },
    { title: "{who} ended the Vainqueur rotation", description: "The hill is flat again." },
  ],
  volunteer: [
    { title: "{player} volunteered to run it back", description: "Lost, and asking for more. Respect, or concern." },
    { title: "{player} wants a rematch", description: "One more game on the losing side, by choice. Brave." },
  ],
  unvolunteer: [
    { title: "{player} withdrew from the rematch", description: "Second thoughts. Wise ones." },
    { title: "{player} changed their mind", description: "The rematch will happen without them." },
  ],
  sit_out: [
    { title: "{player} gave up a winning seat", description: "Off to the queue, undefeated. Generous or scared." },
    { title: "{player} sits out on a win", description: "Leaving on top. The queue welcomes a champion." },
  ],
  next_game: [
    { title: "The rotation turned", description: "Winners stay. Fresh blood comes in from the queue." },
    { title: "Vainqueur: next game", description: "The champions defend the hill. The challengers bring snacks." },
  ],
}

export function narrateVainqueur(event: LiveEvent): Narration {
  const d = event.data as LiveEventPayloads["vainqueur.changed"]
  const player = display(d.playerName)
  const who = actorName(event)
  const lines = lookup(VAINQUEUR, d.action)
  if (!lines || (!player && ["volunteer", "unvolunteer", "sit_out"].includes(d.action))) {
    return { title: `${who} updated the Vainqueur rotation`, description: "The hill rearranges itself.", tone: "info" }
  }
  return say(event, `vq-${d.action}`, lines, { player: player ?? who, who }, "info")
}

const FEARLESS: Record<string, LineTemplate[]> = {
  cleared: [
    { title: "{who} cleared the Fearless list", description: "Every champion is back in the pool. Old sins, new chances." },
    { title: "The Fearless list was wiped", description: "Bans lifted. Someone's comfort pick is back on the menu." },
  ],
  removed: [
    { title: "{champion} returns from Fearless exile", description: "{who} lifted the ban. Someone's main just smiled." },
    { title: "{who} freed {champion}", description: "Back in the pool for the night." },
  ],
  added: [
    { title: "{champion} is banned for the night", description: "Fearless: played once, gone until tomorrow." },
    { title: "{champion} joins the Fearless list", description: "One game, one ride, no encore." },
  ],
}

export function narrateFearless(event: LiveEvent): Narration | null {
  const d = event.data as LiveEventPayloads["fearless.changed"]
  const champion = display(d.champion)
  const lines = lookup(FEARLESS, d.action)
  if (!lines || (d.action !== "cleared" && !champion)) return null
  return say(event, `fearless-${d.action}`, lines, { who: actorName(event), champion: champion ?? "" }, "info")
}

const ACT: Record<string, LineTemplate[]> = {
  active: [
    { title: "Act {act} has begun", description: "A new chapter of the Vive v Vive saga. Old crowns, new grudges." },
    { title: "The curtain rises on Act {act}", description: "The scribes have a fresh page. Salaxe has a fresh notebook." },
  ],
  archived: [
    { title: "Act {act} is over", description: "The scribes are counting the spoils. Rewards await the worthy and the merely present." },
    { title: "The curtain falls on Act {act}", description: "Titles are being engraved. Check the court for your rewards." },
  ],
  upcoming: [{ title: "Act {act} is coming", description: "The stage is being set. Rumor says the crown is involved." }],
}

export function narrateAct(event: LiveEvent): Narration {
  const d = event.data as LiveEventPayloads["act.changed"]
  const lines = lookup(ACT, d.status) ?? ACT.upcoming
  return say(event, `act-${d.status}`, lines, { act: roman(Number(d.actNumber) || 0) }, "royal")
}
