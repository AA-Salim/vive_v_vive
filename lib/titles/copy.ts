import { pts, type HelpEntry } from "@/lib/help"
import { DECREE_COST_RANGE } from "@/lib/titles/effects"
import { LOADOUT_SLOTS, MAX_EQUIPPED, SLOT_COUNT, SLOT_LABEL } from "@/lib/titles/loadout"
import { HAND_KISS_NOTE, PRICE_TIERS, TIER_LABEL, TIER_MULTIPLIER, formatPrice, tierPrice } from "@/lib/titles/pricing"
import { CURSE_GAMES, DIGNITY_MULTIPLIER, MAX_ACTIVE_CURSES, MIN_STAKE, PERK_CAP, PERK_PENALTY_CAP, USER_PERK_CAP } from "@/lib/titles/rules"
import type { PerkInfo } from "@/lib/titles/types"

const slotList = LOADOUT_SLOTS.map((s) => `${SLOT_COUNT[s]} ${SLOT_LABEL[s]}`).join(", ")
const priceList = PRICE_TIERS.map((t) => `${TIER_LABEL[t]} x${TIER_MULTIPLIER[t]} (${formatPrice(tierPrice(t))})`).join(", ")

export const HALL_COPY = {
  title: "The Hall of Titles",
  tagline:
    "Every title bends the rules the moment you act: cheaper decrees, better insurance, fatter praise. Then its perk pays after the game. Every brand bleeds its wearer. Choose wisely, or at least loudly.",
  lockNotice: "The game is live. Titles are sealed until a winner is declared.",
  noBanner: "No banner raised. You are, legally speaking, nobody. Equip a title to bend the rules and collect perks.",
  loadoutsPending: "Loadouts open once the royal scribes finish their migration: one title at a time until then.",
  signedOut: "Sign in with Discord to buy titles, build a loadout and curse your friends.",
  emptyCollection: "Your collection is empty. The shop is open, the milestones are waiting, and Salaxe is judging.",
}

export const EXPLAINER = [
  {
    title: "A loadout, not a banner",
    body: `Wear up to ${MAX_EQUIPPED} titles at once: ${slotList}. Rebels and loyalists never share the super rare slots, and a few broken pairs never mix.`,
  },
  {
    title: "Effects bite the moment you act",
    body: `Decree prices, bet terms, praise rewards, stipends and duel tithes change right away, shown on every price you see. Effects stack, each with a hard cap (decree discounts stop at ${Math.abs(DECREE_COST_RANGE.min)}% off).`,
  },
  {
    title: "Perks pay after the game",
    body: `After every game you take part in (you played, bet ${MIN_STAKE}+, cast a decree or cashed a bounty), each perk pays on its own: at most ${PERK_CAP} per perk, ${USER_PERK_CAP} for all your titles together. The treasury enforces it, whoever declares the winner.`,
  },
  {
    title: "Priced in hand kisses",
    body: `${HAND_KISS_NOTE} Titles cost ${priceList}. Honors are earned, never bought.`,
  },
  {
    title: "Curses",
    body: `Mockery titles are bought for someone else. The brand burns for ${CURSE_GAMES} games, works against its wearer the moment it lands and pays you tribute. ${MAX_ACTIVE_CURSES} brands per subject, maximum.`,
  },
  {
    title: "Buy back your dignity",
    body: `The branded can burn a brand off early for ${DIGNITY_MULTIPLIER === 1 ? "exactly its price" : `${DIGNITY_MULTIPLIER}x its price`}. The Crown keeps the money. The bestower keeps the memories.`,
  },
  {
    title: "Sealed when live",
    body: "Titles lock the moment a game goes live and unlock when the winner is declared. No mid-game costume changes.",
  },
]

const ROASTS: Record<string, string> = {
  "Court Jester": "shall juggle for the court. Funny hat mandatory, bets capped, tips confiscated.",
  "Boot Licker": "shall kneel at the royal boot every single game, and pay extra for every decree. Tongue: still brown.",
  "Royal Carpet": "shall be rolled out before the throne. Every decree aimed at them comes cheaper, every loss pays.",
  "Salaxe's Emotional Support": "shall carry the fallen King's feelings. The daily stipend goes to him now.",
  "The Crawling One": "shall crawl through every bet without a Guardian Angel, paying extra for every loss.",
}

const TAKES_PART = `you played, had a settled bet of ${MIN_STAKE}+, cast a decree or cashed a bounty`

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`)

// Caps are enforced by apply_title_perk() in supabase/phase10_titles.sql from the same numbers.
export function perkHelp(perk: PerkInfo): HelpEntry {
  if (perk.kind === "curse") {
    return {
      title: "Brand",
      does: `${sentence(perk.summary)} Charged after every game the branded takes part in (${TAKES_PART}).`,
      cost: `Up to ${pts(perk.cap)} a game for the branded, never past the debt floor.`,
      reward: "The tribute goes to whoever burned the brand in.",
      limits: `Burns for ${CURSE_GAMES} games. ${MAX_ACTIVE_CURSES} brands per subject at most. Buy it off early for ${DIGNITY_MULTIPLIER}x its price.`,
    }
  }
  return {
    title: "Title perk",
    does: `${sentence(perk.summary)} Paid on its own after every game you take part in (${TAKES_PART}), while this title is equipped.`,
    cost: `Free to equip. A perk that backfires costs you ${pts(PERK_PENALTY_CAP)} at most.`,
    reward: `Up to ${pts(perk.cap)} a game.`,
    limits: `All your perks together pay at most ${pts(USER_PERK_CAP)} a game. Sealed while a game is live.`,
  }
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
