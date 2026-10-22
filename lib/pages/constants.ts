// Win rates below this many games are noise: records and default filters ignore them.
export const RATE_MIN_GAMES = 10

// Form shows this many latest results; a streak needs this many in a row to be called one.
export const FORM_LENGTH = 5
export const STREAK_MIN = 2

// Games together before a duo shows in the default list and the partner finder.
export const DUO_MIN_GAMES = 5

// Each duo honor goes to one qualified duo. Rates are win rates in percent.
export const DUO_BADGE_RULES = {
  minGames: 10,
  dynastyRate: 60,
  cursedRate: 40,
  carryRate: 60,
  carryGap: 15,
  leechWithRate: 55,
  leechWithoutRate: 35,
} as const

// Games against an opponent before he can be your nemesis or favourite victim.
export const MATCHUP_MIN_GAMES = 3
// Games with a teammate before he can be your soulmate or bad omen.
export const PARTNER_MIN_GAMES = 4

export const CHAMPION_MIN_GAMES = 5

export const FEUD_RULES = {
  metGames: 3,
  ownMargin: 4,
  lopsidedGames: 6,
  closeGames: 10,
} as const

// The act Warrior award only counts players with this many games.
export const ACT_WARRIOR_MIN_GAMES = 5
