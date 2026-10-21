import type { Category } from "@/lib/prophecy/constants"
import type { VerdictOutcome } from "@/lib/prophecy/types"

type Fill = Record<string, string>

const MVP_LINES = [
  "By the will of the Charamil, {name} is crowned MVP. Salaxe has been informed. He is drafting a statement.",
  "{name} on {champ} carried so hard the other four should start paying rent.",
  "The court has spoken: {name}. Somewhere in exile, Salaxe writes this name in his little notebook. Underlined. Twice.",
  "{name} played like the crown was still up for grabs. Spoiler: it is.",
  "Every flash on time, every Baron call correct. {name}, the people's MVP. Unlike certain kings.",
  "{name} did the work of five. The other four are welcome to say merci.",
  "A statue of {name} on {champ} will be commissioned. A small one. Budget cuts.",
  "{name} on {champ}: no delayed victories, no excuses, no mercy. The court bows.",
]

const MVP_IN_DEFEAT_LINES = [
  "{name} lost the game and won the court. The jungle diff was not his fault. Probably.",
  "Even in defeat, {name} on {champ} stood tall. The other four were lying in the fountain.",
  "{name} carried a losing team on his back. The court salutes the spine.",
]

const MVP_DUO_LINES = [
  "Two crowns, one game: {a} and {b} share the glory. Salaxe has two new names for the notebook.",
  "{a} and {b} split the crown. Nobody tell Salaxe a crown can be split.",
  "The court could not choose between {a} and {b}, so it chose both. Democracy is beautiful.",
]

const MVP_SALAXE_LINES = [
  "Salaxe has been voted MVP. He says this proves the exile was a clerical error. It proves one game.",
  "The Charamil crowned Salaxe. For one game. Do not let him turn it into a whole Act.",
]

const INTER_LINES = [
  "{name} has been voted Inter. The 0/8 Yone game finally has competition.",
  "{name} on {champ} fed with the dedication of a man on the enemy payroll.",
  "The court finds {name} guilty of grand theft: the enemy gold came from somewhere.",
  "{name} took ff15 as a personal challenge. And lost that too.",
  "{name}: MVP of the enemy team, by a landslide.",
  "{name} found every gank in the game. All of them on himself.",
  "Witnesses saw {name} walk into Baron alone. The court did not need to hear more.",
  "{name} was not inting, he was creating space. Mostly on the death timer.",
  "{name} on {champ} is sentenced to watch his own replay. Twice. With commentary.",
  "Even Salaxe, from exile, sent condolences to {name}'s team. Then he laughed.",
]

const INTER_IN_VICTORY_LINES = [
  "{name} inted and still won. The team carried him like a royal palanquin.",
  "Victory, no thanks to {name}. The court has voted him Inter anyway.",
  "{name} won the game and lost the court. The team would like a word.",
]

const INTER_DUO_LINES = [
  "{a} and {b} inted in perfect harmony. The court could not pick just one.",
  "A double sentence: {a} and {b}. They will share a cell and a death timer.",
  "{a} and {b} tied for Inter. Their team has requested a refund.",
]

const INTER_SALAXE_LINES = [
  "Salaxe has been voted Inter. He says the vote was rigged. He has written down every voter's name.",
  "The court names Salaxe the Inter. The fallen crown falls a little further.",
]

const NO_VERDICT: Record<Category, Record<Exclude<VerdictOutcome, "decided">, string>> = {
  mvp: {
    split: "The court is split. No crown today: the Charamil could not agree, which is very on brand.",
    too_few: "Not enough voices to crown anyone. The throne stays empty, like Salaxe's trophy cabinet.",
    no_votes: "Nobody voted. The court left to queue another game.",
    void: "The game was canceled, so the court crowns no one. The throne stays dusty.",
  },
  inter: {
    split: "The court is split on who inted the most. A rare day where everyone inted equally.",
    too_few: "Not enough voices to convict. The accused walks free. For now.",
    no_votes: "Nobody voted. The inter escapes justice, protected by everyone's laziness.",
    void: "The game was canceled. No game, no crime, no sentence. Case dismissed.",
  },
}

function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pickLine(lines: string[], seed: string): string {
  return lines[hash(seed) % lines.length]
}

function fill(template: string, values: Fill): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "")
}

export interface VerdictLineInput {
  category: Category
  outcome: VerdictOutcome
  names: string[]
  champions: string[]
  onWinningSide: boolean[]
  seed: string
}

export function verdictLine({ category, outcome, names, champions, onWinningSide, seed }: VerdictLineInput): string {
  if (outcome !== "decided" || names.length === 0) {
    return NO_VERDICT[category][outcome === "decided" ? "no_votes" : outcome]
  }
  const key = `${seed}:${category}`
  if (names.length >= 2) {
    return fill(pickLine(category === "mvp" ? MVP_DUO_LINES : INTER_DUO_LINES, key), { a: names[0], b: names[1] })
  }
  const values = { name: names[0], champ: champions[0] || "his champion" }
  if (names[0].toLowerCase() === "salaxe") {
    return fill(pickLine(category === "mvp" ? MVP_SALAXE_LINES : INTER_SALAXE_LINES, key), values)
  }
  if (category === "mvp") {
    return fill(pickLine(onWinningSide[0] === false ? MVP_IN_DEFEAT_LINES : MVP_LINES, key), values)
  }
  return fill(pickLine(onWinningSide[0] === true ? INTER_IN_VICTORY_LINES : INTER_LINES, key), values)
}

export function joinNames(names: string[]): string | null {
  if (names.length === 0) return null
  return names.join(" & ")
}

export function sealLabel(category: Category, playerName: string): string {
  return category === "mvp" ? `${playerName} for MVP` : `${playerName} to int`
}

export const CATEGORY_COPY: Record<
  Category,
  { title: string; short: string; question: string; voteTitle: string; voteVerb: string; crowned: string }
> = {
  mvp: {
    title: "Crown Prophecy",
    short: "MVP",
    question: "Who will the court crown MVP?",
    voteTitle: "Crown the MVP",
    voteVerb: "Crown",
    crowned: "MVP",
  },
  inter: {
    title: "Doom Prophecy",
    short: "Inter",
    question: "Who will the court name the Inter?",
    voteTitle: "Name the Inter",
    voteVerb: "Name",
    crowned: "Inter",
  },
}
