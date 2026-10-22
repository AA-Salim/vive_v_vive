import { FREE, pts, type HelpEntry } from "@/lib/help"
import {
  COURT_WINDOW_DAYS,
  CROWNS_PER_DAY,
  PRAISE_MAX_CHARS,
  PRAISE_MIN_CHARS,
  PRAISE_MIN_WORDS,
  PRAISE_REWARD,
  RIDDLE_DAILY_LIMIT,
  RIDDLE_FIRST_TRY_BONUS,
  ROYAL_FAVOR,
  SALAXE_NAMES,
  VERDICT_NOTE_MAX,
} from "@/lib/praise/rules"

const NAMES = SALAXE_NAMES.slice(0, 4).join(", ")

const WRITING_RULES = `One short line: ${PRAISE_MIN_CHARS} to ${PRAISE_MAX_CHARS} characters, ${PRAISE_MIN_WORDS}+ words, and it must name him (${NAMES}...). Insults are banned, in Darija, French or English, however you spell them. No keyboard mash, repeated words or lines already in the Hall.`

const SHARP_MIND = `${pts(RIDDLE_FIRST_TRY_BONUS)} more (Sharp Mind) if you solved the King's Riddle on the first try`

export const PRAISE_HELP: HelpEntry = {
  title: "Sing His Praises",
  does: "Once a day, solve the King's Riddle first, then sing the exiled king one short line of worship and the treasury pays you. Salaxe reads every one and may crown the best or scorn the worst, in public.",
  cost: FREE,
  reward: `${pts(PRAISE_REWARD)} per praise, ${SHARP_MIND}, plus ${pts(ROYAL_FAVOR)} of Royal Favor if Salaxe crowns it.`,
  limits: `One praise per day, resets at midnight UTC. ${WRITING_RULES}`,
}

export const COMPOSE_HELP: HelpEntry = {
  title: "Compose a praise",
  does: "Step 2 of 2, after the King's Riddle. Write one short line or tap words of worship (Sidna, Eternal King, Mon Roi...). It is checked as you type, then sealed into the Hall of Praise for the whole court to read. Once sung, it cannot be edited.",
  cost: FREE,
  reward: `${pts(PRAISE_REWARD)} the moment it is accepted, ${SHARP_MIND}. A crown from Salaxe adds ${pts(ROYAL_FAVOR)}.`,
  limits: `One a day. ${WRITING_RULES}`,
}

export const RIDDLE_HELP: HelpEntry = {
  title: "The King's Riddle",
  does: "Step 1 of 2: before you may praise him, Salaxe tests your wit with one small puzzle (a number sequence, an arrow pattern or a pipe maze). Solve it and the quill is yours. A wrong answer shows the solution and he poses a new riddle.",
  cost: FREE,
  reward: `The riddle itself pays nothing. Solve it on the first try and your praise pays ${pts(RIDDLE_FIRST_TRY_BONUS)} more: ${pts(PRAISE_REWARD + RIDDLE_FIRST_TRY_BONUS)} instead of ${pts(PRAISE_REWARD)}.`,
  limits: `One riddle at a time, ${RIDDLE_DAILY_LIMIT} a day. One miss, or asking for another riddle, loses the first-try bonus. Miss all ${RIDDLE_DAILY_LIMIT} and there is no praise until midnight UTC.`,
}

export const VERDICT_HELP: HelpEntry = {
  title: "Crown or Scorn",
  does: "The King's verdict on a praise. Crown pays the author Royal Favor from the treasury. Scorn pays nothing and roasts it in the Hall for all to see.",
  cost: `${FREE}. The treasury pays the favor, not the King's purse.`,
  reward: `Crown: ${pts(ROYAL_FAVOR)} to the author. Scorn: nothing, only shame.`,
  limits: `Only the real Salaxe may judge, never his own praise. ${CROWNS_PER_DAY} crowns a day, scorn is unlimited. Verdicts are final and public, with an optional remark up to ${VERDICT_NOTE_MAX} characters. Songs leave the court after ${COURT_WINDOW_DAYS} days.`,
}
