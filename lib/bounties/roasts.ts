import { PILLORY_RULES } from "@/lib/bounties/rules"
import type { ShameStat, ShameStatKey, TribunalVerdict } from "@/lib/bounties/types"

const TEMPLATES: Record<ShameStatKey, string[]> = {
  streak: [
    "{count} losses in a row. The Rift has filed a restraining order.",
    "On a {count}-game losing streak. The minions started a support group.",
    "{count} straight defeats. Even Teemo feels sorry, and Teemo feels nothing.",
    "Lost {count} in a row and queued again. Courage or concussion, the court cannot tell.",
  ],
  week: [
    "{wins}-{losses} this week. The royal scribes ran out of ink writing the Ls.",
    "{rate}% this week. A coin flip would like a word.",
    "{wins}-{losses} this week. Someone check if the monitor is on.",
  ],
  hiding: [
    "Zero games this week. Hiding in the fog of war like an unwarded jungler.",
    "Has not touched the Rift in a week. Afraid of the pillory, and rightly so.",
    "Missing for seven days. Last seen dodging a custom.",
  ],
  champion: [
    "{wins}-{losses} on {champion}. Riot is considering a buff out of pity.",
    "Plays {champion} like the enemy team is paying for it.",
    "{losses} losses on {champion}. The champion has asked for a transfer.",
  ],
  lane: [
    "{wins}-{losses} in {lane}. The lane has asked for a new tenant.",
    "{rate}% in {lane}. The turret has seen things it cannot unsee.",
    "Sent {lane}, came back with {losses} losses and no explanation.",
  ],
  last: [
    "Last seen losing on {champion} {lane}. Wanted for crimes against the minion wave.",
    "That last {champion} game is now taught as a cautionary tale.",
    "Lost the last one on {champion}. The replay was sealed for public safety.",
  ],
  career: [
    "{rate}% career. Consistency is a virtue; losing consistently counts, apparently.",
    "{wins}-{losses} all time. The Shadow Isles have better records.",
  ],
  ghost: [
    "Zero games on record. A legend nobody has ever seen win, or play.",
    "No games at all. Either a myth or a coward. Possibly both.",
  ],
  clean: [
    "{rate}% and smug about it. Pride comes before the 0/10.",
    "Nobody wins this much honestly. The court suspects scripting.",
    "Too clean, too proud. Pilloried on general principle.",
  ],
}

const SALAXE_NICKNAMES = [
  "Le Bon Salaxe",
  "Chalaksse",
  "Chklat",
  "Chklass",
  "SLX",
  "EL Salaxino Goblino",
  "Chalakssinoss",
  "Salaxe Le Genereux",
]

const SALAXE_LINES = [
  "{nick} called Baron solo again. Died in 0.3 seconds. Again.",
  "{nick} swears it was a delayed victory. The scoreboard swears otherwise.",
  "{nick} writes our names in his little notebook. We write his on the wall.",
  "Exiled, petty and 0/8 in spirit. Bonjour, {nick}.",
]

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function fill(template: string, facts: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(facts[key] ?? ""))
}

function pick<T>(items: T[], count: number, seed: number): T[] {
  const pool = [...items]
  const out: T[] = []
  let s = seed
  while (pool.length > 0 && out.length < count) {
    s = Math.imul(s ^ (s >>> 15), 2246822507) >>> 0
    out.push(pool.splice(s % pool.length, 1)[0])
  }
  return out
}

export function isSalaxe(name: string): boolean {
  return name.trim().toLowerCase() === "salaxe"
}

// Three ready-made roasts for a stat; `seed` reshuffles them ("another one").
export function roastsFor(stat: ShameStat, targetName: string, seed = 0, count = 3): string[] {
  const base = hash(`${stat.key}:${targetName}`) + seed * 7919
  const facts = { ...stat.facts, name: targetName }
  const lines = pick(TEMPLATES[stat.key], count, base).map((t) => fill(t, facts))
  if (isSalaxe(targetName)) {
    const nick = SALAXE_NICKNAMES[(base + seed) % SALAXE_NICKNAMES.length]
    const royal = pick(SALAXE_LINES, 1, base + 31).map((t) => fill(t, { nick }))
    return [...royal, ...lines].slice(0, count).filter((line) => line.length <= PILLORY_RULES.messageMax)
  }
  return lines.filter((line) => line.length <= PILLORY_RULES.messageMax)
}

const TRIBUNAL_LINES = [
  "The court has spoken, and the court is disgusted.",
  "The jury saw everything. The jury needs a minute.",
  "Sentenced by their peers. No appeal, no mercy, no wards.",
  "Nine angry players could not have said it better.",
]

export function tribunalLine(verdict: TribunalVerdict, entryId: string): string {
  if (verdict.shared) return "A joint verdict: the inting was a team effort."
  return TRIBUNAL_LINES[hash(entryId) % TRIBUNAL_LINES.length]
}
