import { FREE, pts, type HelpEntry } from "@/lib/help"
import {
  COURT_WINDOW_DAYS,
  CROWNS_PER_DAY,
  PRAISE_MAX_CHARS,
  PRAISE_MIN_CHARS,
  PRAISE_MIN_WORDS,
  PRAISE_PER_DAY,
  RIDDLE_CLOCK_LINE,
  RIDDLE_FIRST_TRY_BONUS,
  RIDDLE_KISS_LIMIT,
  ROYAL_FAVOR,
  SALAXE_NAMES,
  VERDICT_NOTE_MAX,
  kissScheduleLine,
} from "@/lib/praise/rules"

const NAMES = SALAXE_NAMES.slice(0, 4).join(", ")

const WRITING_RULES = `One short line: ${PRAISE_MIN_CHARS} to ${PRAISE_MAX_CHARS} characters, ${PRAISE_MIN_WORDS}+ words, and it must name him (${NAMES}...). Insults are banned, in Darija, French or English, however you spell them. No keyboard mash, repeated words or lines already in the Hall.`

const SHARP_MIND = `${pts(RIDDLE_FIRST_TRY_BONUS)} more (Sharp Mind) for each kiss whose King's Riddle you solved on the first try`

// "4 kisses a day: 200, 150, 100, 50", each kiss paying less than the one before.
const SCHEDULE = kissScheduleLine()

export const PRAISE_HELP: HelpEntry = {
  title: "Sing His Praises",
  does: `Up to ${PRAISE_PER_DAY} times a day, kiss the hand: solve a King's Riddle, then sing the exiled king one short line of worship and the treasury pays you. Salaxe reads every one and may crown the best or scorn the worst, in public.`,
  cost: FREE,
  reward: `${SCHEDULE} points, in that order (title boosts apply to each), ${SHARP_MIND}, plus ${pts(ROYAL_FAVOR)} of Royal Favor if Salaxe crowns one.`,
  limits: `${PRAISE_PER_DAY} praises per day, each with its own riddle, reset at midnight UTC. ${WRITING_RULES}`,
}

export const COMPOSE_HELP: HelpEntry = {
  title: "Compose a praise",
  does: "Step 2 of 2, after the King's Riddle. Write one short line or tap words of worship (Sidna, Eternal King, Mon Roi...). It is checked as you type, then sealed into the Hall of Praise for the whole court to read. Once sung, it cannot be edited.",
  cost: FREE,
  reward: `The kiss's value the moment it is accepted (${SCHEDULE}), ${SHARP_MIND}. A crown from Salaxe adds ${pts(ROYAL_FAVOR)}.`,
  limits: `${PRAISE_PER_DAY} a day, one riddle each. ${WRITING_RULES}`,
}

export const RIDDLE_HELP: HelpEntry = {
  title: "The King's Riddle",
  does: `Step 1 of 2 of every kiss: before you may praise him, Salaxe tests your wit with one small puzzle (a number sequence, an arrow pattern or a pipe maze). Solve it and the quill is yours. A wrong answer shows the solution and he poses a new riddle. ${RIDDLE_CLOCK_LINE}`,
  cost: FREE,
  reward: `The riddle itself pays nothing. Solve it on the first try and that kiss pays ${pts(RIDDLE_FIRST_TRY_BONUS)} more. The time it took and the misses go into the Hall of Kisses, for glory only.`,
  limits: `One riddle at a time, ${RIDDLE_KISS_LIMIT} per kiss. A miss, a skip or running out of time loses the first-try bonus. Miss all ${RIDDLE_KISS_LIMIT} and there are no more kisses until midnight UTC.`,
}

export const VERDICT_HELP: HelpEntry = {
  title: "Crown or Scorn",
  does: "The King's verdict on a praise. Crown pays the author Royal Favor from the treasury. Scorn pays nothing and roasts it in the Hall for all to see.",
  cost: `${FREE}. The treasury pays the favor, not the King's purse.`,
  reward: `Crown: ${pts(ROYAL_FAVOR)} to the author. Scorn: nothing, only shame.`,
  limits: `Only the real Salaxe may judge, never his own praise. ${CROWNS_PER_DAY} crowns a day, scorn is unlimited. Verdicts are final and public, with an optional remark up to ${VERDICT_NOTE_MAX} characters. Songs leave the court after ${COURT_WINDOW_DAYS} days.`,
}
