import type { ChronicleEntry, ChronicleKind } from "@/lib/lore/chronicle/types"
import type { NightFacts, PlayerRecord } from "@/lib/lore/chronicle/facts"
import { isSalaxe } from "@/lib/lore/salaxe"
import { pick } from "@/lib/lore/seed"
import { asName, asNum, loreLine, type LoreLine, type LoreValue } from "@/lib/lore/segments"
import type { Side } from "@/lib/types"

const numbers = new Intl.NumberFormat("en-US")
const n = (value: number) => asNum(numbers.format(Math.round(value)))
const signed = (value: number) => asNum(`${value > 0 ? "+" : "-"}${numbers.format(Math.abs(Math.round(value)))}`)
const record = (r: { wins: number; losses: number }) => asNum(`${r.wins}-${r.losses}`)
const side = (s: Side): LoreValue => ({ text: s === "blue" ? "Blue" : "Red", mark: s })
const who = (name: string): LoreValue => (isSalaxe(name) ? { text: "Salaxe", mark: "salaxe" } : asName(name))

function listOf(names: string[], max = 3): string {
  if (names.length <= 1) return names[0] ?? ""
  const shown = names.slice(0, max)
  const rest = names.length - shown.length
  if (rest > 0) return `${shown.join(", ")} and ${rest} more`
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`
}

function line(facts: NightFacts, kind: ChronicleKind, templates: readonly string[], values: Record<string, LoreValue>): ChronicleEntry {
  return { kind, ...loreLine(`${facts.id}:${kind}`, pick(templates, `${facts.id}:${kind}`), values) }
}

function episode(facts: NightFacts): LoreLine {
  const seed = `${facts.id}:episode`
  const make = (templates: string[], values: Record<string, LoreValue> = {}) => loreLine(seed, pick(templates, seed), values)
  const s = facts.salaxe
  const sweep = facts.games >= 3 && (facts.blueWins === facts.games || facts.redWins === facts.games)
  if (sweep) {
    return make(["The {side} Supremacy", "A Night Painted {side}", "Nothing but {side}"], {
      side: side(facts.blueWins === facts.games ? "blue" : "red"),
    })
  }
  if (s && s.wins + s.losses >= 2 && s.wins === 0) {
    return make(["The Night of Delayed Victories", "Salaxe and the Long Recall", "The Exile Has a Bad Night"])
  }
  if (s && s.wins + s.losses >= 2 && s.losses === 0) {
    return make(["The Return of the King (Allegedly)", "Salaxe Remembers How to Win", "The Crown Stirs"])
  }
  if (facts.best && facts.best.wins >= 3 && facts.best.losses <= 1) {
    return make(["The Night {best} Refused to Lose", "{best} and the Unbreakable Streak", "In Which {best} Carries Everyone"], {
      best: who(facts.best.name),
    })
  }
  if (facts.biggestWin && facts.biggestWin.profit >= 200) {
    return make(["{name} Breaks the Bank", "The Night {name} Robbed the Bookmaker"], { name: who(facts.biggestWin.name) })
  }
  if (facts.worst && facts.worst.losses >= 3 && facts.worst.wins === 0) {
    return make(["The Fall of {worst}", "{worst} and the Gray Screen"], { worst: who(facts.worst.name) })
  }
  if (facts.decrees.count >= 10) return make(["The Night of a Thousand Decrees", "Ink, Spite and Rerolls"])
  return make(["Ten Souls, Five Lanes", "Another Night on the Rift", "The Charamil Plays On", "Business as Usual on the Rift"])
}

function opening(facts: NightFacts): ChronicleEntry {
  const { games, blueWins, redWins } = facts
  if (games === 1) {
    return line(facts, "opening", [
      "One game. One. The Charamil queued, played, and vanished like a support who saw the gank coming.",
      "A single game on the Rift, and {winner} took it. Short, sharp, and already being argued about.",
    ], { winner: side(blueWins > 0 ? "blue" : "red") })
  }
  if (blueWins === redWins) {
    return line(facts, "opening", [
      "{games} games, a perfect {wins}-{wins} split. The Rift's way of saying nobody learned anything.",
      "{games} games and dead even, {wins} apiece. Balance, as all things should be. Except the jungle.",
    ], { games: n(games), wins: n(blueWins) })
  }
  const blueLeads = blueWins > redWins
  return line(facts, "opening", [
    "{games} games on the Rift. {leader} side took {lead}, {trailer} side took {trail} and the blame.",
    "The Charamil played {games} games. Final ledger: {leader} {lead}, {trailer} {trail}. The excuses are still being counted.",
    "{games} games, {lead}-{trail} for {leader} side. Somewhere, a jungler is still explaining himself.",
  ], {
    games: n(games),
    leader: side(blueLeads ? "blue" : "red"),
    trailer: side(blueLeads ? "red" : "blue"),
    lead: n(Math.max(blueWins, redWins)),
    trail: n(Math.min(blueWins, redWins)),
  })
}

function champion(facts: NightFacts, best: PlayerRecord): ChronicleEntry {
  const values = { best: who(best.name), record: record(best) }
  return best.losses === 0
    ? line(facts, "champion", [
        "{best} went {record}. Undefeated, unbothered, and probably unbearable in voice chat.",
        "{best} finished {record}. Not a single loss. The notebook has started a page just for them.",
      ], values)
    : line(facts, "champion", [
        "{best} went {record}. Every lane they touched turned gold.",
        "MVP of the ledger: {best}, {record}. The other nine are welcome to take notes.",
        "{best} finished {record}, the kind of night that ends with a smug avatar and a new title.",
      ], values)
}

function cursed(facts: NightFacts, worst: PlayerRecord): ChronicleEntry {
  const values = { worst: who(worst.name), record: record(worst) }
  return worst.wins === 0
    ? line(facts, "cursed", [
        "{worst} went {record}. Zero wins. The randomizer has been asked to apologize.",
        "{worst} closed the night at {record}. The gray screen knows them by name now.",
      ], values)
    : line(facts, "cursed", [
        "{worst} went {record}. The Shame Board has been notified and is warming up.",
        "{worst} finished {record}. Not a slump: a delayed victory, as the exile would say.",
        "Spare a thought for {worst}: {record}. The fountain saw a lot of them tonight.",
      ], values)
}

function salaxe(facts: NightFacts, s: NonNullable<NightFacts["salaxe"]>): ChronicleEntry {
  const games = s.wins + s.losses
  if (games === 0) {
    return line(facts, "salaxe", [
      "Salaxe did not play. Sources in exile say he was \"reviewing VODs\". Other people's.",
      "No Salaxe on the Rift tonight. The notebook, however, attended every game.",
    ], {})
  }
  const champs = s.champions.length > 0 ? ` on ${listOf(s.champions)}` : ""
  const values = { salaxe: who("salaxe"), record: record(s), champs }
  if (s.wins === 0) {
    return line(facts, "salaxe", [
      "{salaxe} went {record}{champs}. He has filed every one of them under delayed victories.",
      "{salaxe}: {record}{champs}. The notebook gained several names tonight. All teammates.",
      "{record} for {salaxe}{champs}. He calls it a tactical retreat with extra steps.",
    ], values)
  }
  if (s.losses === 0) {
    return line(facts, "salaxe", [
      "{salaxe} went {record}{champs}. A press release titled \"I Never Left\" is already drafted.",
      "{record} for {salaxe}{champs}. The crown on the floor twitched. Rebels, take note.",
    ], values)
  }
  if (s.wins > s.losses) {
    return line(facts, "salaxe", [
      "{salaxe} finished {record}{champs}. Positive record, insufferable tone. The exile smells a comeback.",
      "{record} for {salaxe}{champs}. He would like everyone to stop calling it luck.",
    ], values)
  }
  if (s.wins < s.losses) {
    return line(facts, "salaxe", [
      "{salaxe} went {record}{champs}. Not defeat, he insists. Strategic generosity.",
      "{salaxe}: {record}{champs}. The losses have been sent to the scribes for rewording.",
    ], values)
  }
  return line(facts, "salaxe", [
    "{salaxe} went {record}{champs}. Perfectly balanced, as all delayed victories should be.",
    "{record} for {salaxe}{champs}. Half king, half cautionary tale.",
  ], values)
}

function tribunal(facts: NightFacts, t: NonNullable<NightFacts["tribunal"]>): ChronicleEntry | null {
  const times = (count: number) => (count > 2 ? ` ${count} times` : count === 2 ? " twice" : "")
  if (t.mvp && t.inter) {
    return line(facts, "tribunal", [
      "The Tribunal crowned {mvp}{mvpTimes} and condemned {inter}{interTimes}.",
      "Court verdicts: MVP {mvp}{mvpTimes}, Inter {inter}{interTimes}. Appeals denied.",
    ], { mvp: who(t.mvp.name), mvpTimes: times(t.mvp.count), inter: who(t.inter.name), interTimes: times(t.inter.count) })
  }
  if (t.mvp) {
    return line(facts, "tribunal", [
      "The Tribunal crowned {mvp}{mvpTimes}. Nobody was convicted, which is suspicious.",
      "Court verdicts: {mvp} wore the MVP crown{mvpTimes}. The Inter walked free.",
    ], { mvp: who(t.mvp.name), mvpTimes: times(t.mvp.count) })
  }
  if (t.inter) {
    return line(facts, "tribunal", [
      "The Tribunal crowned nobody and convicted {inter}{interTimes}. Harsh, but fair.",
      "No MVP worth crowning, but {inter} was named the Inter{interTimes}.",
    ], { inter: who(t.inter.name), interTimes: times(t.inter.count) })
  }
  return null
}

function wager(facts: NightFacts): ChronicleEntry | null {
  const win = facts.biggestWin
  const loss = facts.biggestLoss
  if (win && loss) {
    return line(facts, "wager", [
      "{winner} turned {stake} into {payout} on {wside}. {loser} lost {loss}. Same Rift, different universe.",
      "Best ticket: {winner}, {profit}. Worst ticket: {loser}, -{loss}. The bookmaker thanks you both.",
    ], { winner: who(win.name), stake: n(win.stake), payout: n(win.payout), profit: signed(win.profit), wside: side(win.side), loser: who(loss.name), loss: n(loss.loss) })
  }
  if (win) {
    return line(facts, "wager", [
      "{winner} turned {stake} into {payout} on {wside}. The bookmaker would like a word.",
      "Best ticket of the night: {winner}, {profit} on {wside}.",
    ], { winner: who(win.name), stake: n(win.stake), payout: n(win.payout), profit: signed(win.profit), wside: side(win.side) })
  }
  if (loss) {
    return line(facts, "wager", loss.insured
      ? ["{loser} lost {loss} even with a Guardian Angel. Even angels have limits."]
      : [
          "{loser} lost {loss} on {lside}. The Guardian Angel was on break.",
          "Worst ticket of the night: {loser}, -{loss}. Thoughts and prayers.",
        ], { loser: who(loss.name), loss: n(loss.loss), lside: side(loss.side) })
  }
  return null
}

function decree(facts: NightFacts): ChronicleEntry | null {
  const d = facts.decrees
  if (d.count === 0 || !d.caster) return null
  const values = {
    count: n(d.count),
    spent: n(d.spent),
    caster: who(d.caster.name),
    casterCount: n(d.caster.count),
    favorite: { text: d.favorite ?? "the quill", mark: "title" as const },
  }
  if (d.count === 1) {
    return line(facts, "decree", ["One decree all night: {caster} signed {favorite}. Restraint, or poverty."], values)
  }
  if (d.caster.tied || d.caster.count < 2) {
    return line(facts, "decree", [
      "{count} decrees signed for {spent} points, spread across the whole court. Everyone had a grudge to file.",
      "The Crown collected {spent} points across {count} decrees. Weapon of choice: {favorite}. Nobody held back.",
    ], values)
  }
  return line(facts, "decree", [
    "{count} decrees signed for {spent} points. {caster} alone signed {casterCount}. Spite is a renewable resource.",
    "The Crown collected {spent} points in decrees. Weapon of choice: {favorite}. Chief vandal: {caster}.",
    "{count} decrees, {spent} points of pure spite, with {caster} leading the charge.",
  ], values)
}

function treasury(facts: NightFacts): ChronicleEntry | null {
  const { gainer, loser } = facts.treasury
  if (gainer && loser) {
    return line(facts, "treasury", [
      "Biggest winner of the night: {gainer}, {gain}. Biggest loser: {loser}, {loss}. The economy is fine.",
      "{gainer} left {gainAbs} points richer. {loser} left {lossAbs} poorer. The treasury balanced its books.",
    ], {
      gainer: who(gainer.name),
      gain: signed(gainer.delta),
      gainAbs: n(gainer.delta),
      loser: who(loser.name),
      loss: signed(loser.delta),
      lossAbs: n(Math.abs(loser.delta)),
    })
  }
  if (gainer) {
    return line(facts, "treasury", ["{gainer} went home {gain} points richer. Everyone else broke even, or pretends to."], {
      gainer: who(gainer.name),
      gain: n(gainer.delta),
    })
  }
  if (loser) {
    return line(facts, "treasury", ["{loser} went home {loss} points lighter. The exile sends condolences, and an invoice."], {
      loser: who(loser.name),
      loss: n(Math.abs(loser.delta)),
    })
  }
  return null
}

function closing(facts: NightFacts): ChronicleEntry {
  return facts.ongoing
    ? line(facts, "closing", [
        "The night is young. The notebook is open. Next game, next chapter.",
        "To be continued, possibly in the next ten minutes.",
      ], {})
    : line(facts, "closing", [
        "To be continued. Salaxe has already drafted the next chapter in his notebook.",
        "Same Rift, same rivals, fresh grudges. The next episode starts when ten players say ready.",
        "And so the Charamil logged off, each convinced it was the jungler's fault.",
      ], {})
}

export function writeNight(facts: NightFacts): { episode: LoreLine; entries: ChronicleEntry[] } {
  const entries = [
    opening(facts),
    facts.best ? champion(facts, facts.best) : null,
    facts.worst ? cursed(facts, facts.worst) : null,
    facts.salaxe ? salaxe(facts, facts.salaxe) : null,
    facts.tribunal ? tribunal(facts, facts.tribunal) : null,
    wager(facts),
    facts.allInLosers.length > 0
      ? line(facts, "allin", [
          "{names} went all-in and lost it all. The notebook underlined the names twice.",
          "All-in, all gone: {names}. Salaxe sends his warmest regards.",
        ], { names: asName(listOf(facts.allInLosers)) })
      : null,
    decree(facts),
    treasury(facts),
    closing(facts),
  ].filter((entry): entry is ChronicleEntry => entry !== null)
  return { episode: episode(facts), entries }
}
