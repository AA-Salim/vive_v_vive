import { FREE, pts, type HelpEntry } from "@/lib/help"

export type MilestoneStat =
  | "games_played"
  | "wins"
  | "win_rate"
  | "bets_placed"
  | "bets_won"
  | "total_earned"
  | "devotion_count"
  | "shames_received"
  | "chaos_used"
  | "bounties_placed"

export type MilestoneGroupKey =
  | "games"
  | "wins"
  | "winrate"
  | "bets"
  | "bet_wins"
  | "earned"
  | "devotion"
  | "shames"
  | "chaos"
  | "bounties"

export interface MilestoneDefinition {
  id: string
  title: string
  description: string
  group: MilestoneGroupKey
  threshold: number
  stat: MilestoneStat
}

export const MILESTONE_GROUPS: { key: MilestoneGroupKey; label: string; blurb: string }[] = [
  { key: "games", label: "Games Played", blurb: "Time served on the Rift." },
  { key: "wins", label: "Victories", blurb: "Real ones, not delayed ones." },
  { key: "winrate", label: "Win Rate", blurb: "Minimum 10 games. No tourists." },
  { key: "bets", label: "Bets Placed", blurb: "The house remembers every one." },
  { key: "bet_wins", label: "Bets Won", blurb: "Prophets of the pari-mutuel." },
  { key: "earned", label: "Points Earned", blurb: "Real income only. Refunds are not a paycheck." },
  { key: "devotion", label: "Devotion", blurb: "Hands kissed, praises sung." },
  { key: "shames", label: "Shames Received", blurb: "Character building, allegedly." },
  { key: "chaos", label: "Royal Decrees", blurb: "Chaos sown, drafts ruined." },
  { key: "bounties", label: "Bounties", blurb: "Wanted posters printed." },
]

export const MILESTONES: MilestoneDefinition[] = [
  { id: "games-10", title: "Summoned", description: "Play 10 games", group: "games", threshold: 10, stat: "games_played" },
  { id: "games-20", title: "Committed to the Rift", description: "Play 20 games", group: "games", threshold: 20, stat: "games_played" },
  { id: "games-30", title: "The Regular", description: "Play 30 games", group: "games", threshold: 30, stat: "games_played" },
  { id: "games-40", title: "Can't Stop Won't Stop", description: "Play 40 games", group: "games", threshold: 40, stat: "games_played" },
  { id: "games-50", title: "Half-Century Club", description: "Play 50 games", group: "games", threshold: 50, stat: "games_played" },
  { id: "games-60", title: "Grass Is a Myth", description: "Play 60 games", group: "games", threshold: 60, stat: "games_played" },
  { id: "games-70", title: "Vive v Vive Addict", description: "Play 70 games", group: "games", threshold: 70, stat: "games_played" },
  { id: "games-80", title: "This Game Is My Personality", description: "Play 80 games", group: "games", threshold: 80, stat: "games_played" },

  { id: "wins-5", title: "First Taste of Victory", description: "Win 5 games", group: "wins", threshold: 5, stat: "wins" },
  { id: "wins-15", title: "Winner By Habit", description: "Win 15 games", group: "wins", threshold: 15, stat: "wins" },
  { id: "wins-30", title: "The Carry", description: "Win 30 games", group: "wins", threshold: 30, stat: "wins" },
  { id: "wins-50", title: "Unkillable Legacy", description: "Win 50 games", group: "wins", threshold: 50, stat: "wins" },

  { id: "wr-25", title: "At Least You Tried", description: "Reach 25% win rate", group: "winrate", threshold: 25, stat: "win_rate" },
  { id: "wr-50", title: "Coinflip Merchant", description: "Reach 50% win rate", group: "winrate", threshold: 50, stat: "win_rate" },
  { id: "wr-75", title: "Random Champs, Calculated Wins", description: "Reach 75% win rate", group: "winrate", threshold: 75, stat: "win_rate" },

  { id: "bets-5", title: "Baby Gambler", description: "Place 5 bets", group: "bets", threshold: 5, stat: "bets_placed" },
  { id: "bets-15", title: "Degenerate In Training", description: "Place 15 bets", group: "bets", threshold: 15, stat: "bets_placed" },
  { id: "bets-30", title: "Can't Help Myself", description: "Place 30 bets", group: "bets", threshold: 30, stat: "bets_placed" },
  { id: "bets-50", title: "The House Should Be Worried", description: "Place 50 bets", group: "bets", threshold: 50, stat: "bets_placed" },

  { id: "betwins-3", title: "Lucky Guess", description: "Win 3 bets", group: "bet_wins", threshold: 3, stat: "bets_won" },
  { id: "betwins-10", title: "Fortune's Favorite", description: "Win 10 bets", group: "bet_wins", threshold: 10, stat: "bets_won" },
  { id: "betwins-25", title: "The Oracle", description: "Win 25 bets", group: "bet_wins", threshold: 25, stat: "bets_won" },

  { id: "earned-500", title: "Pocket Change", description: "Earn 500 points in total", group: "earned", threshold: 500, stat: "total_earned" },
  { id: "earned-1000", title: "Stacking Paper", description: "Earn 1,000 points in total", group: "earned", threshold: 1000, stat: "total_earned" },
  { id: "earned-2500", title: "Economy Enjoyer", description: "Earn 2,500 points in total", group: "earned", threshold: 2500, stat: "total_earned" },
  { id: "earned-5000", title: "Walking Treasury", description: "Earn 5,000 points in total", group: "earned", threshold: 5000, stat: "total_earned" },

  { id: "devotion-5", title: "Salaxe Appreciator", description: "Praise Salaxe 5 times", group: "devotion", threshold: 5, stat: "devotion_count" },
  { id: "devotion-15", title: "Devoted Servant", description: "Praise Salaxe 15 times", group: "devotion", threshold: 15, stat: "devotion_count" },
  { id: "devotion-30", title: "Down Horrendous For Salaxe", description: "Praise Salaxe 30 times", group: "devotion", threshold: 30, stat: "devotion_count" },

  { id: "shames-3", title: "First Blood (Emotional)", description: "Get shamed 3 times", group: "shames", threshold: 3, stat: "shames_received" },
  { id: "shames-10", title: "Community Punching Bag", description: "Get shamed 10 times", group: "shames", threshold: 10, stat: "shames_received" },
  { id: "shames-25", title: "Shame Sponge", description: "Get shamed 25 times", group: "shames", threshold: 25, stat: "shames_received" },

  { id: "chaos-3", title: "Mischief Maker", description: "Cast 3 Royal Decrees", group: "chaos", threshold: 3, stat: "chaos_used" },
  { id: "chaos-10", title: "Chaos Enjoyer", description: "Cast 10 Royal Decrees", group: "chaos", threshold: 10, stat: "chaos_used" },
  { id: "chaos-25", title: "Chaos Incarnate", description: "Cast 25 Royal Decrees", group: "chaos", threshold: 25, stat: "chaos_used" },

  { id: "bounties-3", title: "Bounty Poster", description: "Post 3 bounties", group: "bounties", threshold: 3, stat: "bounties_placed" },
  { id: "bounties-10", title: "Most Wanted Printer", description: "Post 10 bounties", group: "bounties", threshold: 10, stat: "bounties_placed" },
]

// Mirrors isIncomeReason() and loadMarketProfits() in lib/income.ts, which compute total_earned.
export const MILESTONE_GROUP_HELP: Partial<Record<MilestoneGroupKey, HelpEntry>> = {
  earned: {
    title: "Points Earned",
    does: "Counts what the court truly paid you: game wages, the daily stipend, praises, Royal Favor, MVP bonuses, title perks and tributes, bounties, plus the profit of every bet, duel, prophecy and King's Wager you won.",
    cost: FREE,
    reward: MILESTONES.filter((m) => m.stat === "total_earned")
      .map((m) => `${m.title} at ${pts(m.threshold)}`)
      .join(", "),
    limits:
      "A stake coming home earns nothing: refunds, withdrawn duels and Guardian Angel cover do not count, and neither do starting purses or act honors.",
  },
}
