import { roman } from "@/lib/lore/herald/kit"
import { pick } from "@/lib/lore/seed"

// Act I consolation titles were already handed out under these exact names: never edit or reorder them.
const ACT1_CONSOLATION_TITLES = [
  "Salaxe's Background Character",
  "Court Jester (Unpaid)",
  "Throne Room Tourist",
  "The One Who Was There",
  "Salaxe's Tax Write-Off",
  "Professional Bystander",
  "Royal Seat Warmer",
  "The Forgettable",
  "Act I Survivor (Barely)",
  "Salaxe's Emotional Baggage",
  "Crown Witness (Did Not Touch It)",
  "The NPC",
  "Vive v Vive Benchwarmer",
  "Salaxe's Least Favorite",
  "The One Who Showed Up",
  "Royal Court Filler",
  "Act I: Participated",
  "Charamil's Most Average",
  "Almost Relevant",
  "Salaxe's Forgotten Minion",
]

const CONSOLATION_TITLES = [
  "Footnote of the Fallen Crown",
  "Witness to the 0.3 Seconds",
  "Notebook Entry (In Pencil)",
  "The Exile's Pen Pal",
  "Throne Room Janitor",
  "Rebel Without a Cause",
  "Loyalist Without a King",
  "Delayed Victory Recipient",
  "Baron Pit Spectator",
  "Understudy of the 0/8",
  "Neutral Party (Suspicious)",
  "Charamil Extra #7",
  "Crown Floor Sweeper",
  "The Ward Nobody Placed",
  "Minion Wave Enthusiast",
  "Honorary Gray Screen",
  "Unpaid Court Reporter",
  "Most Average Subject",
  "The One Who Watched",
  "Benchwarmer of the Exile",
]

// Same hash the first consolation claims used, so every Act I subject keeps the title they were dealt.
function legacyHash(value: string, max: number): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % max
}

export function consolationTitle(userId: string, actId: number | string, actNumber: number): string {
  const titles = actNumber === 1 ? ACT1_CONSOLATION_TITLES : CONSOLATION_TITLES
  return titles[legacyHash(`${userId}${actId}`, titles.length)]
}

export function consolationDescription(actNumber: number): string {
  return `A participation trophy from Act ${roman(actNumber)}. Worn with whatever pride survived it.`
}

export interface RewardCopy {
  label: string
  flavor: string
  engraved: string
}

export const REWARD_COPY: Record<string, RewardCopy> = {
  treasury: {
    label: "The Treasury",
    flavor: "Richest purse when the curtain fell. Salaxe has already asked for a loan.",
    engraved: "The richest purse of the Act just got heavier.",
  },
  grand_champion: {
    label: "Grand Champion",
    flavor: "The crown of the Act's treasury. Comes with bragging rights and a target on your back.",
    engraved: "Wear it loudly. Everyone else will.",
  },
  warrior: {
    label: "The Warrior",
    flavor: "Best win rate of the Act, five games minimum, zero excuses.",
    engraved: "Built different, documented properly.",
  },
  iron_man: {
    label: "The Iron Man",
    flavor: "Most games played. The Rift has a chair molded to your exact shape.",
    engraved: "Grass remains untouched. The court salutes you.",
  },
  degenerate: {
    label: "The Degenerate",
    flavor: "Most bets placed. The bookmaker named a yacht after you.",
    engraved: "The bookmaker sends his warmest regards.",
  },
  devotee: {
    label: "The Devotee",
    flavor: "Most devotion shown to the royal hand. Your lips are on a first-name basis with it.",
    engraved: "Your devotion has earned a pension.",
  },
  punching_bag: {
    label: "The Punching Bag",
    flavor: "Most shamed. The Shame Board would close without you.",
    engraved: "Somehow, you are still standing.",
  },
  consolation: {
    label: "Participation Trophy",
    flavor: "Not every hero gets a statue. Some get this.",
    engraved: "Wear it with whatever is left of your pride.",
  },
}

export function rewardCopy(category: string): RewardCopy {
  return REWARD_COPY[category] ?? { label: category.replace(/_/g, " "), flavor: "", engraved: "History has been updated." }
}

const CONSOLATION_ROASTS = [
  "Act {act} saw everything you did and chose violence. Here is your souvenir.",
  "You played an entire Act and won exactly nothing. Statistically, that is impressive.",
  "The awards were handed out. You were not on the list. You were barely on the roster.",
  "Salaxe reviewed your Act {act} and said even he would not give you a title. Then he did. This one.",
  "Everyone else is claiming bonus points. You are claiming emotional damage.",
  "No bonus, no glory, no parade. But you showed up, and showing up is most of feeding.",
  "The crown fell and somehow still did not land anywhere near you.",
  "The scribes searched the records for your highlights. They found a ward. One.",
  "Act {act} left you a gift, wrapped in pity and tied with a gray screen.",
  "You were the background music of Act {act}. Essential. Unnoticed. Slightly off-key.",
  "Your Act {act} was reviewed by a panel of experts. The panel needs a moment.",
  "The Hall of Fame was full, so the Hall of Fine opened just for you.",
  "Somebody had to keep the bench warm. The bench thanks you.",
  "This trophy is made from one hundred percent recycled excuses.",
]

const CONSOLATION_ASIDES = [
  "But since you bothered showing up...",
  "Still, attendance counts for something. Barely.",
  "The court is nothing if not charitable. Occasionally.",
]

const CEREMONY_LINES = [
  "The scribes have counted, the heralds have shouted, the treasury has groaned. These are yours.",
  "By decree of the Archive, the following honors are engraved in your name.",
  "Act {act} is over. Its spoils are not. Collect what history owes you.",
  "Salaxe tried to lose the paperwork. The paperwork survived.",
  "The court rises for the decorated. Try not to trip on the way up.",
  "Glory, titles and cold, hard points. Sign here, here, and here.",
]

function fillAct(line: string, actNumber: number): string {
  return line.replace(/\{act\}/g, roman(actNumber))
}

export function consolationRoast(seed: string, actNumber: number): string {
  return fillAct(pick(CONSOLATION_ROASTS, `roast:${seed}`), actNumber)
}

export function consolationAside(seed: string): string {
  return pick(CONSOLATION_ASIDES, `aside:${seed}`)
}

export function ceremonyLine(seed: string, actNumber: number): string {
  return fillAct(pick(CEREMONY_LINES, `ceremony:${seed}`), actNumber)
}
