import { CURSE_GAMES, MAX_ACTIVE_CURSES, MIN_STAKE, PERK_CAP } from "@/lib/titles/rules"

export const HALL_COPY = {
  title: "The Hall of Titles",
  tagline: "Every banner pays out after the game. Every brand bleeds its wearer. Choose wisely, or at least loudly.",
  lockNotice: "The game is live. Titles are sealed until a winner is declared.",
  noBanner: "No banner raised. You are, legally speaking, nobody. Equip a title to start collecting perks.",
  signedOut: "Sign in with Discord to buy titles, raise a banner and curse your friends.",
  emptyCollection: "Your collection is empty. The shop is open, the milestones are waiting, and Salaxe is judging.",
}

export const EXPLAINER = [
  {
    title: "One banner at a time",
    body: `Equip one title. After every game you take part in (you played, bet ${MIN_STAKE}+, cast a decree or cashed a bounty), its perk pays out on its own.`,
  },
  {
    title: "Small, capped, honest",
    body: `No title moves more than ${PERK_CAP} points in a single game. Payouts land in your history as title perks.`,
  },
  {
    title: "Rebels and loyalists",
    body: "Rebellion titles cash in when Salaxe's side falls, Loyalty titles when it wins. The King can neither slay nor worship himself.",
  },
  {
    title: "Curses",
    body: `Mockery titles are bought for someone else. The brand burns for ${CURSE_GAMES} games, shows on their player card and pays you tribute. ${MAX_ACTIVE_CURSES} brands per subject, maximum.`,
  },
  {
    title: "Buy back your dignity",
    body: "The branded can burn a brand off early for 1.5x its price. The Crown keeps the money. The bestower keeps the memories.",
  },
  {
    title: "Sealed when live",
    body: "Titles lock the moment a game goes live and unlock when the winner is declared. No mid-game costume changes.",
  },
]

const ROASTS: Record<string, string> = {
  "Court Jester": "shall juggle for the court. Funny hat mandatory, tips confiscated.",
  "Boot Licker": "shall kneel at the royal boot every single game. Tongue: still brown.",
  "Royal Carpet": "shall be rolled out before the throne. Every loss, the court walks all over them.",
  "Salaxe's Emotional Support": "shall carry the fallen King's feelings. Every win, the wages go to someone else.",
  "The Crawling One": "shall crawl through every lost bet, paying a little extra for the privilege.",
}

export function proclamation(bestower: string, target: string, title: string): string {
  return `By royal decree of ${bestower}, ${target} shall henceforth be known as ${title}.`
}

export function roastFor(title: string, target: string): string {
  return `${target} ${ROASTS[title] ?? "shall bear this brand until it burns out."}`
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}
