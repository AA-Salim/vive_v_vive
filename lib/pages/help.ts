import { DEBT_FLOOR } from "@/lib/economy"
import { FREE, pts, type HelpEntry } from "@/lib/help"
import {
  ACT_WARRIOR_MIN_GAMES,
  CHAMPION_MIN_GAMES,
  DUO_BADGE_RULES,
  FEUD_RULES,
  FORM_LENGTH,
  MATCHUP_MIN_GAMES,
  PARTNER_MIN_GAMES,
  RATE_MIN_GAMES,
  STREAK_MIN,
} from "@/lib/pages/constants"
import { PRAISE_REWARD } from "@/lib/praise/rules"
import { MIN_VOTES_FOR_VERDICT, MVP_BONUS } from "@/lib/prophecy/constants"
import { GAME_PARTICIPATION_POINTS, GAME_WIN_POINTS } from "@/lib/session/constants"

const READ_ONLY = "Free: reading the books costs nothing"
const GAME_PAY = `Each game pays its players +${GAME_PARTICIPATION_POINTS}, and the winners +${GAME_WIN_POINTS} more`
const DEVOTION_LINE = `praises sung for Salaxe (hands kissed, back in Act I). Each daily praise pays +${PRAISE_REWARD}`

export const LEADERBOARD_HELP: HelpEntry = {
  title: "The Treasury",
  does: "Every noble ranked by balance: the points they hold right now, after every win, wager, decree and title. Earnings do not count, so a big earner who spends it all ranks below a careful saver.",
  cost: READ_ONLY,
  reward: "When the act ends, the richest purse takes The Treasury award and its carry-over bonus",
  limits: `Arrows show the last 24 hours. Purses can sink to ${DEBT_FLOOR}, never lower. Every act resets them.`,
}

export const TREASURY_TOTALS_HELP = {
  coin: {
    title: "Coin in play",
    does: "Every purse in the kingdom added up, debts subtracted.",
    cost: READ_ONLY,
    limits: "Stipends, wages and praise add coin. Decrees, titles, shame and tithes burn it.",
  },
  moved: {
    title: "Moved today",
    does: "Every point that changed hands in the last 24 hours, gains and losses both counted.",
    cost: READ_ONLY,
  },
  debt: {
    title: "In debt",
    does: "Nobles whose balance is below zero. They still play and earn, but their spending stops at the floor.",
    cost: READ_ONLY,
    limits: `The debt floor is ${DEBT_FLOOR}. The next act wipes every debt.`,
  },
} satisfies Record<string, HelpEntry>

export const COURT_LIST_HELP: HelpEntry = {
  title: "The rest of the court",
  does: "Everyone below the podium, in balance order. Tap a name to open their court file.",
  cost: READ_ONLY,
  limits: `Record: wins and losses of their claimed player. Devotion: ${DEVOTION_LINE}. Last move: their latest ledger line.`,
}

export const PROFILE_HELP = {
  earned: {
    title: "Earned",
    does: "Every point that came into your purse this act: starting purse, wages, payouts, praise and refunds.",
    cost: FREE,
  },
  spent: {
    title: "Spent",
    does: "Every point that left your purse this act: stakes, premiums, decrees, titles, pledges and shame.",
    cost: FREE,
  },
  net: {
    title: "Net result",
    does: "Earned minus spent since the act began, starting purse included. It is how your balance got where it is.",
    cost: FREE,
  },
  devotion: {
    title: "Devotion",
    does: `How many ${DEVOTION_LINE}.`,
    cost: FREE,
    reward: `${pts(PRAISE_REWARD)} per praise`,
    limits: "One praise a day, written in the match room.",
  },
  curve: {
    title: "Treasury curve",
    does: "Your balance after every movement this act. Hover or tap the curve to read each step.",
    cost: READ_ONLY,
    limits: "Peak and low point are your highest and lowest balance. Best and worst day add up a whole day's movements.",
  },
  trail: {
    title: "Follow the money",
    does: "This act's income and spending, grouped by feature. The i on a group tells you what feeds it.",
    cost: READ_ONLY,
  },
  record: {
    title: "Your record on the Rift",
    does: "Your claimed player's record over every declared game: wins, lanes, champions and the people around you.",
    cost: READ_ONLY,
    reward: GAME_PAY,
    limits: `Nemesis and favourite victim need ${MATCHUP_MIN_GAMES}+ games against you. Soulmate and bad omen need ${PARTNER_MIN_GAMES}+ games together.`,
  },
  deeds: {
    title: "Deeds",
    does: "Milestones for games, wins, bets, devotion, decrees and more. Every tier you reach unlocks an honor title.",
    cost: FREE,
    reward: "An honor title, engraved for free in the Hall of Titles. Some carry a perk",
    limits: "Dots are tiers: gold is engraved, ringed is ready to claim.",
  },
  ledger: {
    title: "The ledger",
    does: "Your latest movements, newest first, grouped by day. The i on a line says what it is and what the feature behind it costs.",
    cost: READ_ONLY,
  },
  economy: {
    title: "How the points work",
    does: "Every way points enter and leave a purse, with the amounts the court actually charges and pays.",
    cost: READ_ONLY,
    limits: `Everything stops at the debt floor of ${DEBT_FLOOR}. Every act resets every purse.`,
  },
} satisfies Record<string, HelpEntry>

export const STATS_HELP = {
  page: {
    title: "Player Stats",
    does: "Every player's record across all declared games, plus the records worth bragging about.",
    cost: READ_ONLY,
    reward: GAME_PAY,
    limits: `Win rates only count from ${RATE_MIN_GAMES} games: the default list hides anyone below.`,
  },
  games: { title: "Games played", does: "Every game with a declared winner. Canceled games do not count.", cost: READ_ONLY },
  players: { title: "Players", does: "Everyone who sat in at least one declared game.", cost: READ_ONLY },
  sides: { title: "Side war", does: "Wins by Blue and by Red across every game.", cost: READ_ONLY },
  since: { title: "Since", does: "The day of the first recorded game.", cost: READ_ONLY },
  roster: {
    title: "The roster",
    does: `Games, W and L count declared games. Win rate is wins over games. Form shows the last ${FORM_LENGTH} results, newest first, with the live streak.`,
    cost: READ_ONLY,
    limits: `"${RATE_MIN_GAMES}+ games" hides newcomers. Streaks show from ${STREAK_MIN} in a row. Main lane and Most dealt come from the randomizer.`,
  },
} satisfies Record<string, HelpEntry>

const RECORD_DOES: Record<string, string> = {
  most_wins: "Most games won, all time.",
  best_rate: `Highest win rate among players with ${RATE_MIN_GAMES}+ games.`,
  iron_man: "Most games played, all time.",
  hot_streak: `Longest winning run still alive, ${STREAK_MIN}+ wins in a row.`,
  cold_streak: `Longest losing run still alive, ${STREAK_MIN}+ losses in a row.`,
  golden_era: "Longest win streak ever recorded.",
  champion_ocean: "Most different champions played.",
}

export function recordHelp(id: string, label: string): HelpEntry {
  return { title: label, does: RECORD_DOES[id] ?? "A record from the books.", cost: READ_ONLY, limits: "Ties go to whoever played more games." }
}

export function rivalriesHelp(matrixSize: number) {
  return {
    page: {
      title: "Rivalries",
      does: "Head-to-head records of every pair of players who met on opposite sides.",
      cost: READ_ONLY,
      limits: "A lane duel is a game where both played the same lane.",
    },
    nemesis: {
      title: "Arch-nemesis",
      does: "The pair with the most lane duels: same lane, opposite sides. The big numbers are lane duels won.",
      cost: READ_ONLY,
      limits: "Ties go to the pair with more games.",
    },
    feuds: {
      title: "Feud finder",
      does: "Every opponent of the chosen player, most frequent first, with their record and lane duels.",
      cost: READ_ONLY,
      limits: `Under ${FEUD_RULES.metGames} games: "Barely met". ${FEUD_RULES.ownMargin}+ more wins and at least double: "Owns him". Otherwise ahead or behind.`,
    },
    table: {
      title: "The war table",
      does: "Each cell is the row player's wins and losses against the column player. Green leads, red trails, the sword marks lane duels.",
      cost: READ_ONLY,
      limits: `"Top ${matrixSize}" shows the most active players.`,
    },
  } satisfies Record<string, HelpEntry>
}

const HIGHLIGHT_DOES: Record<string, string> = {
  most: "The pair with the most games on opposite sides.",
  lopsided: `The most one-sided feud among pairs with ${FEUD_RULES.lopsidedGames}+ games.`,
  closest: `The most even feud among pairs with ${FEUD_RULES.closeGames}+ games.`,
}

export function highlightHelp(id: string, label: string): HelpEntry {
  return { title: label, does: HIGHLIGHT_DOES[id] ?? "A feud worth watching.", cost: READ_ONLY, limits: "Each feud shows up in one highlight at most." }
}

export function duosHelp(minGames: number) {
  return {
    page: {
      title: "Duos",
      does: "Records of every pair of players who shared a side: who carries, who gets carried.",
      cost: READ_ONLY,
      limits: `The default list needs ${minGames}+ games together.`,
    },
    partners: {
      title: "Partner finder",
      does: "The chosen player's teammates. Lucky charms win the most together, bad omens the least.",
      cost: READ_ONLY,
      limits: `Counts partners with ${minGames}+ games together. Bad omens are under 50%.`,
    },
    list: {
      title: "Every pairing",
      does: "Every duo with its wins, losses and win rate together. Tap one for every game they shared.",
      cost: READ_ONLY,
      limits: `"${minGames}+ games" hides one-night stands. "All" shows every pair.`,
    },
  } satisfies Record<string, HelpEntry>
}

const BADGE_DOES: Record<string, string> = {
  knees: "Headline of the duo with the most wins together.",
  daddy: "Headline of the duo with the second most wins together.",
  ride_or_die: "Headline of the duo with the third most wins together.",
  dynasty: `Best win rate together, ${DUO_BADGE_RULES.dynastyRate}% or more.`,
  cursed: `Worst win rate together, under ${DUO_BADGE_RULES.cursedRate}%.`,
  inseparable: "Most games played side by side.",
  carry: `A duo winning ${DUO_BADGE_RULES.carryRate}%+ together where one player's own win rate beats the other's by ${DUO_BADGE_RULES.carryGap}+ points.`,
  nothing_without: `A player who wins ${DUO_BADGE_RULES.leechWithRate}%+ with this partner and under ${DUO_BADGE_RULES.leechWithoutRate}% without him.`,
}

const HEADLINES = new Set(["knees", "daddy", "ride_or_die"])

export function duoBadgeHelp(id: string, label: string): HelpEntry {
  return {
    title: label,
    does: BADGE_DOES[id] ?? "An honor for a memorable duo.",
    cost: READ_ONLY,
    limits: HEADLINES.has(id)
      ? "The player with the better overall win rate gets the credit."
      : `Only duos with ${DUO_BADGE_RULES.minGames}+ games together qualify. Each honor goes to one duo.`,
  }
}

export const CHAMPIONS_HELP = {
  page: {
    title: "Champions",
    does: "Every champion the randomizer dealt, and how the players who got it did.",
    cost: READ_ONLY,
  },
  picks: { title: "Picks dealt", does: "Champions dealt across every game, one per seat.", cost: READ_ONLY },
  seen: { title: "Champions seen", does: "Different champions dealt at least once, out of every champion in the lane pools.", cost: READ_ONLY },
  waiting: { title: "Still waiting", does: "Champions in the pools the dice never dealt.", cost: READ_ONLY },
  most: { title: "Most dealt", does: "The champion the dice dealt most often.", cost: READ_ONLY },
  blessed: {
    title: "Blessed pick",
    does: `Best win rate among champions dealt ${CHAMPION_MIN_GAMES}+ times.`,
    cost: READ_ONLY,
  },
  cursed: {
    title: "Cursed pick",
    does: `Worst win rate among champions dealt ${CHAMPION_MIN_GAMES}+ times.`,
    cost: READ_ONLY,
  },
  pools: {
    title: "Draft pools",
    does: "Every champion the randomizer can deal in each lane. Grey ones have never been dealt.",
    cost: READ_ONLY,
  },
} satisfies Record<string, HelpEntry>

export const HISTORY_HELP: HelpEntry = {
  title: "Match History",
  does: "Every declared game, newest first and grouped by night. Tap a game for its lane matchups.",
  cost: READ_ONLY,
  reward: `${GAME_PAY}. The Tribunal's MVP gets +${MVP_BONUS}`,
  limits: "Chips show the betting pool, the decrees cast and the Tribunal's verdict.",
}

export const VERDICT_HELP: HelpEntry = {
  title: "The Tribunal",
  does: "After every game the court votes the MVP and the Inter of the game.",
  cost: "Free to vote",
  reward: `The MVP gets +${MVP_BONUS}. The Inter goes up in the pillory, free of charge`,
  limits: `The leader needs ${MIN_VOTES_FOR_VERDICT}+ votes. A two-way tie crowns both.`,
}

export const ARCHIVES_HELP: HelpEntry = {
  title: "Archives",
  does: "Every act of the saga. A new act resets every purse; when an act ends, its Hall of Fame hands out awards.",
  cost: READ_ONLY,
  reward: "Award winners carry bonus points into the next act",
  limits: "The running act updates live. Sealed acts never change.",
}

export const ARCHIVE_DETAIL_HELP = {
  days: { title: "Days", does: "How long the act ran, or has run so far.", cost: READ_ONLY },
  games: { title: "Games", does: "Games declared during the act.", cost: READ_ONLY },
  wagers: { title: "Wagers", does: "Bets placed during the act.", cost: READ_ONLY },
  wagered: { title: "Wagered", does: "Points staked on bets that counted, refunds left out.", cost: READ_ONLY },
  decrees: { title: "Decrees", does: "Royal Decrees cast during the act.", cost: READ_ONLY },
  devotion: { title: "Devotion", does: `All the ${DEVOTION_LINE}.`, cost: READ_ONLY },
  fame: {
    title: "Hall of Fame",
    does: "The act's honors, handed out when it ends. Each award names what it measured and the bonus it carried over.",
    cost: READ_ONLY,
    reward: "Carry-over bonus points, claimed when the next act opens",
  },
  race: {
    title: "The race for the treasury",
    does: "Every noble's balance at the end of each day of the act. Pick anyone to put them in the spotlight.",
    cost: READ_ONLY,
  },
  bets: {
    title: "Wager outcomes",
    does: "How many wagers each bettor won, lost and got refunded during the act.",
    cost: READ_ONLY,
  },
  spending: {
    title: "Where the coin went",
    does: "Every point spent during the act, by feature.",
    cost: READ_ONLY,
  },
  standings: {
    title: "Standings",
    does: "Treasury is the balance that ranks. Earned and Spent are every point in and out during the act.",
    cost: READ_ONLY,
    limits: `Devotion counts ${DEVOTION_LINE}.`,
  },
} satisfies Record<string, HelpEntry>

const AWARD_DOES: Record<string, string> = {
  treasury: "The richest purse when the act ended.",
  grand_champion: "The crown of the act's treasury: the richest purse when the act ended.",
  warrior: `The best win rate when the act ended, among players with ${ACT_WARRIOR_MIN_GAMES}+ games.`,
  iron_man: "The most games played when the act ended.",
  degenerate: "The most bets placed during the act.",
  devotee: "The most praises sung (hands kissed, in Act I) during the act.",
  punching_bag: "The most times put in the pillory during the act.",
}

export function awardHelp(category: string, label: string, bonus: number): HelpEntry {
  return {
    title: label,
    does: AWARD_DOES[category] ?? "An honor of the act.",
    cost: FREE,
    reward: bonus > 0 ? `${pts(bonus)} carried into the next act` : "Glory only, no carry-over bonus",
    limits: "Claimed once from the reward banner when the next act opens.",
  }
}
