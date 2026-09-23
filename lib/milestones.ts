export interface MilestoneDefinition {
  id: string
  title: string
  description: string
  group: string
  threshold: number
  stat: string
}

export const MILESTONE_GROUPS: { key: string; label: string; color: string }[] = [
  { key: "games", label: "Games Played", color: "text-blue-400" },
  { key: "wins", label: "Victories", color: "text-green-400" },
  { key: "winrate", label: "Win Rate", color: "text-emerald-400" },
  { key: "bets", label: "Bets Placed", color: "text-yellow-400" },
  { key: "bet_wins", label: "Bets Won", color: "text-amber-400" },
  { key: "earned", label: "Points Earned", color: "text-[var(--color-gold)]" },
  { key: "devotion", label: "Devotion", color: "text-pink-400" },
  { key: "shames", label: "Shames Received", color: "text-orange-400" },
  { key: "chaos", label: "Chaos Actions", color: "text-purple-400" },
  { key: "bounties", label: "Bounties", color: "text-red-400" },
]

export const MILESTONES: MilestoneDefinition[] = [
  // Games Played
  { id: "games-10", title: "Summoned", description: "Play 10 games", group: "games", threshold: 10, stat: "games_played" },
  { id: "games-20", title: "Committed to the Rift", description: "Play 20 games", group: "games", threshold: 20, stat: "games_played" },
  { id: "games-30", title: "The Regular", description: "Play 30 games", group: "games", threshold: 30, stat: "games_played" },
  { id: "games-40", title: "Can't Stop Won't Stop", description: "Play 40 games", group: "games", threshold: 40, stat: "games_played" },
  { id: "games-50", title: "Half-Century Club", description: "Play 50 games", group: "games", threshold: 50, stat: "games_played" },
  { id: "games-60", title: "Grass Is a Myth", description: "Play 60 games", group: "games", threshold: 60, stat: "games_played" },
  { id: "games-70", title: "Vive v Vive Addict", description: "Play 70 games", group: "games", threshold: 70, stat: "games_played" },
  { id: "games-80", title: "This Game Is My Personality", description: "Play 80 games", group: "games", threshold: 80, stat: "games_played" },

  // Victories
  { id: "wins-5", title: "First Taste of Victory", description: "Win 5 games", group: "wins", threshold: 5, stat: "wins" },
  { id: "wins-15", title: "Winner By Habit", description: "Win 15 games", group: "wins", threshold: 15, stat: "wins" },
  { id: "wins-30", title: "The Carry", description: "Win 30 games", group: "wins", threshold: 30, stat: "wins" },
  { id: "wins-50", title: "Unkillable Legacy", description: "Win 50 games", group: "wins", threshold: 50, stat: "wins" },

  // Win Rate (min 10 games, stored as percentage 0-100)
  { id: "wr-25", title: "At Least You Tried", description: "Reach 25% win rate (min 10 games)", group: "winrate", threshold: 25, stat: "win_rate" },
  { id: "wr-50", title: "Coinflip Merchant", description: "Reach 50% win rate (min 10 games)", group: "winrate", threshold: 50, stat: "win_rate" },
  { id: "wr-75", title: "Random Champs, Calculated Wins", description: "Reach 75% win rate (min 10 games)", group: "winrate", threshold: 75, stat: "win_rate" },

  // Bets Placed
  { id: "bets-5", title: "Baby Gambler", description: "Place 5 bets", group: "bets", threshold: 5, stat: "bets_placed" },
  { id: "bets-15", title: "Degenerate In Training", description: "Place 15 bets", group: "bets", threshold: 15, stat: "bets_placed" },
  { id: "bets-30", title: "Can't Help Myself", description: "Place 30 bets", group: "bets", threshold: 30, stat: "bets_placed" },
  { id: "bets-50", title: "The House Should Be Worried", description: "Place 50 bets", group: "bets", threshold: 50, stat: "bets_placed" },

  // Bets Won
  { id: "betwins-3", title: "Lucky Guess", description: "Win 3 bets", group: "bet_wins", threshold: 3, stat: "bets_won" },
  { id: "betwins-10", title: "Fortune's Favorite", description: "Win 10 bets", group: "bet_wins", threshold: 10, stat: "bets_won" },
  { id: "betwins-25", title: "The Oracle", description: "Win 25 bets", group: "bet_wins", threshold: 25, stat: "bets_won" },

  // Points Earned (total)
  { id: "earned-500", title: "Pocket Change", description: "Earn 500 total points", group: "earned", threshold: 500, stat: "total_earned" },
  { id: "earned-1000", title: "Stacking Paper", description: "Earn 1,000 total points", group: "earned", threshold: 1000, stat: "total_earned" },
  { id: "earned-2500", title: "Economy Enjoyer", description: "Earn 2,500 total points", group: "earned", threshold: 2500, stat: "total_earned" },
  { id: "earned-5000", title: "Walking Treasury", description: "Earn 5,000 total points", group: "earned", threshold: 5000, stat: "total_earned" },

  // Devotion (kisses + praises)
  { id: "devotion-5", title: "Salaxe Appreciator", description: "Praise Salaxe 5 times", group: "devotion", threshold: 5, stat: "devotion_count" },
  { id: "devotion-15", title: "Devoted Servant", description: "Praise Salaxe 15 times", group: "devotion", threshold: 15, stat: "devotion_count" },
  { id: "devotion-30", title: "Down Horrendous For Salaxe", description: "Praise Salaxe 30 times", group: "devotion", threshold: 30, stat: "devotion_count" },

  // Shames Received
  { id: "shames-3", title: "First Blood (Emotional)", description: "Get shamed 3 times", group: "shames", threshold: 3, stat: "shames_received" },
  { id: "shames-10", title: "Community Punching Bag", description: "Get shamed 10 times", group: "shames", threshold: 10, stat: "shames_received" },
  { id: "shames-25", title: "Shame Sponge", description: "Get shamed 25 times", group: "shames", threshold: 25, stat: "shames_received" },

  // Chaos Actions
  { id: "chaos-3", title: "Mischief Maker", description: "Use 3 chaos actions", group: "chaos", threshold: 3, stat: "chaos_used" },
  { id: "chaos-10", title: "Chaos Enjoyer", description: "Use 10 chaos actions", group: "chaos", threshold: 10, stat: "chaos_used" },
  { id: "chaos-25", title: "Chaos Incarnate", description: "Use 25 chaos actions", group: "chaos", threshold: 25, stat: "chaos_used" },

  // Bounties
  { id: "bounties-3", title: "Bounty Poster", description: "Place 3 bounties", group: "bounties", threshold: 3, stat: "bounties_placed" },
  { id: "bounties-10", title: "Most Wanted Printer", description: "Place 10 bounties", group: "bounties", threshold: 10, stat: "bounties_placed" },
]
