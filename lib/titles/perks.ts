import { MIN_STAKE } from "@/lib/titles/rules"
import {
  betDividend,
  betLossRefund,
  betProfitShare,
  bountyBonus,
  chaosRefund,
  coinFlip,
  crownFalls,
  crownPlays,
  crownWins,
  crownWon,
  fixed,
  hit,
  loss,
  onLoss,
  onPlay,
  onWin,
  profit,
  share,
  shareCap,
  staked,
  tribute,
  type PerkDefinition,
} from "@/lib/titles/perk-kit"
import type { TitleCategory } from "@/lib/titles/types"

export type { PerkDefinition, PerkGame, PerkHit, PerkSubject } from "@/lib/titles/perk-kit"

// Every cap below is seeded into title_perk_caps (supabase/phase10_titles.sql), and apply_title_perk() clamps each
// payout to it: change a cap, a title name or an award kind in both places. Caps of share-based perks go through
// shareCap() (1.5x under the second title rules).
const BARON_WIN = 10
const BARON_LOSS = 4
const PLOT_TWIST = 5

const SHOP_PERKS: Record<string, PerkDefinition> = {
  Kingslayer: {
    kind: "perk",
    trigger: "crown_falls",
    get cap() {
      return shareCap(60)
    },
    describe: fixed("When Salaxe's side falls: +25% bet profit, +12 if you played"),
    evaluate: (s, g) => {
      if (!crownPlays(s, g) || crownWon(g)) return null
      const fromBet = s.bet?.won && s.bet.side !== g.salaxeSide ? share(profit(s), 25) : 0
      const fromPlay = s.play && s.play.side !== g.salaxeSide ? 12 : 0
      const detail = fromPlay > 0 ? "Slew the King on the Rift" : "Cashed in on the King's fall"
      return hit(fromBet + fromPlay, detail)
    },
  },
  "The Usurper": onWin(8, "Took another throne"),
  "Crown Thief": crownFalls(8, "Lifted a jewel from the fallen crown"),
  "The Disrespector": {
    kind: "perk",
    trigger: "bet_loss",
    get cap() {
      return shareCap(40)
    },
    describe: fixed(`Bet ${MIN_STAKE}+ against Salaxe's side: +4, and 30% back if it loses`),
    evaluate: (s, g) => {
      if (!crownPlays(s, g) || !s.bet || !staked(s) || s.bet.side === g.salaxeSide) return null
      return s.bet.won ? hit(4, "Disrespected the crown, profitably") : hit(4 + share(loss(s), 30), "Disrespect refund, no questions asked")
    },
  },
  "The One Who Stopped Kneeling": {
    kind: "perk",
    trigger: "crown_falls",
    cap: 16,
    describe: fixed("Face Salaxe on the Rift: +6, or +16 if you beat him"),
    evaluate: (s, g) => {
      if (!crownPlays(s, g) || !s.play || s.play.side === g.salaxeSide) return null
      return s.play.won ? hit(16, "Beat Salaxe standing up") : hit(6, "Faced Salaxe without kneeling")
    },
  },

  "Still Kneeling": crownWins(8, "Knelt, and was rewarded"),
  "Throne Polisher": {
    kind: "perk",
    trigger: "crown_wins",
    cap: 12,
    describe: fixed("Salaxe's side wins: +5, or +12 if you were on it"),
    evaluate: (s, g) => {
      if (!crownPlays(s, g) || !crownWon(g)) return null
      return s.play?.side === g.salaxeSide ? hit(12, "Polished the throne from the inside") : hit(5, "Polished the throne")
    },
  },
  "The Holdout": {
    kind: "perk",
    trigger: "bet_loss",
    get cap() {
      return shareCap(40)
    },
    describe: fixed(`Bet ${MIN_STAKE}+ on Salaxe's side: +4, and 30% back if he loses`),
    evaluate: (s, g) => {
      if (!crownPlays(s, g) || !s.bet || !staked(s) || s.bet.side !== g.salaxeSide) return null
      return s.bet.won ? hit(4, "Held out, and was right") : hit(4 + share(loss(s), 30), "Copium refund on a royal bet")
    },
  },
  "Last Loyalist": {
    kind: "perk",
    trigger: "bet_win",
    get cap() {
      return shareCap(60)
    },
    describe: fixed(`Bet ${MIN_STAKE}+ on Salaxe's side: +3, plus 40% of the profit if he wins`),
    evaluate: (s, g) => {
      if (!crownPlays(s, g) || !s.bet || !staked(s) || s.bet.side !== g.salaxeSide) return null
      return s.bet.won ? hit(3 + share(profit(s), 40), "Loyalty paid out") : hit(3, "Stayed when everyone left")
    },
  },
  "Copium Dealer": {
    kind: "perk",
    trigger: "crown_falls",
    get cap() {
      return shareCap(24)
    },
    describe: () => `Salaxe's side loses: +3 per bettor who backed him (max ${shareCap(24)})`,
    evaluate: (s, g) => {
      if (!crownPlays(s, g) || crownWon(g) || g.salaxeSide === null) return null
      const self = s.bet?.side === g.salaxeSide ? 1 : 0
      const buyers = Math.max(0, g.backers[g.salaxeSide] - self)
      return hit(buyers * 3, `Sold copium to ${buyers} grieving loyalist${buyers === 1 ? "" : "s"}`)
    },
  },

  "Baron Caller (Derogatory)": {
    kind: "perk",
    trigger: "chance",
    cap: BARON_WIN,
    downside: BARON_LOSS,
    describe: fixed(`Every game: 50% chance of +${BARON_WIN}, 50% chance of -${BARON_LOSS}`),
    evaluate: (_s, _g, roll) =>
      roll < 0.5 ? hit(BARON_WIN, "Called Baron. It worked.") : hit(-BARON_LOSS, "Called Baron. Died alone."),
  },
  "The 0/8 Powerspike": {
    kind: "perk",
    trigger: "bet_loss",
    get cap() {
      return shareCap(30)
    },
    describe: fixed("Lose a bet: 15% back. Lose a game: +3"),
    evaluate: (s) => hit(share(loss(s), 15) + (s.play && !s.play.won ? 3 : 0), "The powerspike is coming. Any minute now."),
  },
  "Delayed Victory Specialist": onLoss(8, "Victory delayed, not denied", "+8 every game you lose: a loss now pays like a win"),
  "Main Character (Self-Diagnosed)": {
    kind: "perk",
    trigger: "bet_win",
    get cap() {
      return shareCap(60)
    },
    downside: PLOT_TWIST,
    describe: fixed(`Bet on your own team: +30% profit if it wins, -${PLOT_TWIST} if it loses`),
    evaluate: (s) => {
      if (!s.play || !s.bet || s.bet.side !== s.play.side) return null
      return s.bet.won ? hit(share(profit(s), 30), "Main character energy") : hit(-PLOT_TWIST, "Plot twist: side character arc")
    },
  },
  "El Goblino Pequeno": {
    kind: "perk",
    trigger: "pool",
    get cap() {
      return shareCap(15)
    },
    describe: () => `Skim 1% of the betting pool every game (max ${shareCap(15)})`,
    evaluate: (_s, g) => hit(share(g.pool, 1), "Skimmed the pot like a true goblin"),
  },

  "Court Jester": {
    kind: "curse",
    trigger: "bet_win",
    cap: 50,
    describe: (to) => `25% of bet profits go to ${to} (max 50)`,
    evaluate: (s) => hit(-share(profit(s), 25), "Paid the jester tax"),
  },
  "Boot Licker": tribute(6, "Licked the boot"),
  "Royal Carpet": {
    kind: "curse",
    trigger: "loss",
    cap: 10,
    describe: (to) => `Every game lost: 10 points to ${to}`,
    evaluate: (s) => (s.play && !s.play.won ? hit(-10, "Got walked on") : null),
  },
  "Salaxe's Emotional Support": {
    kind: "curse",
    trigger: "win",
    cap: 10,
    describe: (to) => `Every game won: 10 points to ${to}. Unpaid.`,
    evaluate: (s) => (s.play?.won ? hit(-10, "Worked a win for free") : null),
  },
  "The Crawling One": {
    kind: "curse",
    trigger: "bet_loss",
    cap: 40,
    describe: (to) => `Lost bets cost 20% extra, paid to ${to} (max 40)`,
    evaluate: (s) => hit(-share(s.bet && !s.bet.won ? s.bet.stake : 0, 20), "Crawled through a lost bet"),
  },
}

const MILESTONE_PERKS: Record<string, PerkDefinition> = {
  Summoned: onPlay(1, "Answered the summons"),
  "Committed to the Rift": onPlay(1, "Committed, again"),
  "The Regular": onPlay(2, "The usual seat"),
  "Can't Stop Won't Stop": onPlay(2, "Did not stop"),
  "Half-Century Club": onPlay(2, "Club dues paid"),
  "Grass Is a Myth": onPlay(3, "Grass remains theoretical"),
  "Vive v Vive Addict": onPlay(3, "Fed the habit"),
  "This Game Is My Personality": onPlay(3, "Personality maintained"),

  "First Taste of Victory": onWin(2, "Another taste"),
  "Winner By Habit": onWin(3, "Habit confirmed"),
  "The Carry": onWin(4, "Carried, as usual"),
  "Unkillable Legacy": onWin(5, "Legacy intact"),

  "At Least You Tried": onLoss(3, "Tried. Lost. Paid."),
  "Coinflip Merchant": coinFlip(6, "The coin landed your way"),
  "Random Champs, Calculated Wins": onWin(6, "Calculated, obviously"),

  "Baby Gambler": betLossRefund(5, 10, "A tiny refund for a tiny gambler"),
  "Degenerate In Training": betLossRefund(8, 15, "Training subsidy"),
  "Can't Help Myself": betLossRefund(10, 20, "Helped, slightly"),
  "The House Should Be Worried": betLossRefund(12, 25, "The house blinked first"),

  "Lucky Guess": betProfitShare(5, 10, "Lucky again"),
  "Fortune's Favorite": betProfitShare(8, 20, "Fortune smiled"),
  "The Oracle": betProfitShare(12, 30, "The Oracle saw it coming"),

  "Pocket Change": betDividend(1, "Pocket change dividend"),
  "Stacking Paper": betDividend(2, "Stacked a little more"),
  "Economy Enjoyer": betDividend(3, "Enjoyed the economy"),
  "Walking Treasury": betDividend(4, "Treasury interest"),

  "Salaxe Appreciator": crownWins(3, "Appreciated, and paid"),
  "Devoted Servant": crownWins(5, "Devotion rewarded"),
  "Down Horrendous For Salaxe": crownWins(8, "Down horrendous, up 8"),

  "First Blood (Emotional)": onLoss(3, "Emotional damage, compensated"),
  "Community Punching Bag": onLoss(5, "Absorbed another hit"),
  "Shame Sponge": onLoss(8, "Soaked it up"),

  "Mischief Maker": chaosRefund(4, 6, "Mischief rebate"),
  "Chaos Enjoyer": chaosRefund(7, 10, "Chaos rebate"),
  "Chaos Incarnate": chaosRefund(10, 15, "Chaos pays its own"),

  "Bounty Poster": bountyBonus(10, 20, "Bounty bonus"),
  "Most Wanted Printer": bountyBonus(20, 40, "Printed another poster"),
}

const ACT_AWARD_PERKS: Record<string, PerkDefinition> = {
  "grand champion": {
    kind: "perk",
    trigger: "win",
    cap: 5,
    describe: fixed("+5 every game you win, +2 when you lose"),
    evaluate: (s) => (s.play ? hit(s.play.won ? 5 : 2, "Paid like royalty, win or lose") : null),
  },
  warrior: onWin(5, "Built different"),
  "iron man": onPlay(3, "Another game, no life detected"),
  degenerate: betLossRefund(15, 30, "Degenerate's discount"),
  devotee: crownWins(8, "Devotion rewarded"),
  "punching bag": onLoss(6, "Absorbed another hit, professionally"),
}

const ACT_AWARD_PATTERN = /^Act\s+(?:[IVXLC]+|\d+):?\s+(Grand Champion|Warrior|Iron Man|Degenerate|Devotee|Punching Bag)$/i

export const CONSOLATION_TITLES: ReadonlySet<string> = new Set([
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
])

const CONSOLATION_PERK = onPlay(2, "Showed up. That is the whole bit.")

const CATEGORY_DEFAULTS: Record<TitleCategory, PerkDefinition> = {
  rebellion: crownFalls(4, "The rebellion pays its own"),
  loyalty: crownWins(4, "Loyalty pays"),
  absurd: coinFlip(6, "The absurd paid off"),
  mockery: tribute(4, "Paid the brander"),
  award: onPlay(1, "Showed up"),
}

export function actAwardKind(name: string): string | null {
  const match = ACT_AWARD_PATTERN.exec(name.trim())
  return match ? match[1].toLowerCase() : null
}

export function isConsolationTitle(name: string): boolean {
  return CONSOLATION_TITLES.has(name)
}

export function perkFor(name: string, category: string): PerkDefinition | null {
  const exact = SHOP_PERKS[name] ?? MILESTONE_PERKS[name]
  if (exact) return exact
  const award = actAwardKind(name)
  if (award) return ACT_AWARD_PERKS[award] ?? null
  if (CONSOLATION_TITLES.has(name)) return CONSOLATION_PERK
  return CATEGORY_DEFAULTS[category as TitleCategory] ?? null
}
