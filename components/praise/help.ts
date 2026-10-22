import { FREE, pts, type HelpEntry } from "@/lib/help"
import {
  COURT_WINDOW_DAYS,
  CROWNS_PER_DAY,
  PRAISE_MAX_CHARS,
  PRAISE_MIN_CHARS,
  PRAISE_MIN_WORDS,
  PRAISE_REWARD,
  ROYAL_FAVOR,
  SALAXE_NAMES,
  VERDICT_NOTE_MAX,
} from "@/lib/praise/rules"

const NAMES = SALAXE_NAMES.slice(0, 4).join(", ")

const WRITING_RULES = `${PRAISE_MIN_WORDS}+ words, ${PRAISE_MIN_CHARS} to ${PRAISE_MAX_CHARS} characters, and it must name him (${NAMES}...). No keyboard mash, filler, copied prompts or songs already in the Hall.`

export const PRAISE_HELP: HelpEntry = {
  title: "Sing His Praises",
  does: "Write the exiled king a few kind words once a day and the treasury pays you. Salaxe reads every one and may crown the best or scorn the worst, in public.",
  cost: FREE,
  reward: `${pts(PRAISE_REWARD)} per praise, plus ${pts(ROYAL_FAVOR)} of Royal Favor if Salaxe crowns it.`,
  limits: `One praise per day, resets at midnight UTC. ${WRITING_RULES}`,
}

export const COMPOSE_HELP: HelpEntry = {
  title: "Compose a praise",
  does: "Your praise is checked as you type, then sealed into the Hall of Praise for the whole court to read. Once sung, it cannot be edited.",
  cost: FREE,
  reward: `${pts(PRAISE_REWARD)} the moment it is accepted. A crown from Salaxe adds ${pts(ROYAL_FAVOR)}.`,
  limits: `One a day. ${WRITING_RULES}`,
}

export const VERDICT_HELP: HelpEntry = {
  title: "Crown or Scorn",
  does: "The King's verdict on a praise. Crown pays the author Royal Favor from the treasury. Scorn pays nothing and roasts it in the Hall for all to see.",
  cost: `${FREE}. The treasury pays the favor, not the King's purse.`,
  reward: `Crown: ${pts(ROYAL_FAVOR)} to the author. Scorn: nothing, only shame.`,
  limits: `Only the real Salaxe may judge, never his own praise. ${CROWNS_PER_DAY} crowns a day, scorn is unlimited. Verdicts are final and public, with an optional remark up to ${VERDICT_NOTE_MAX} characters. Songs leave the court after ${COURT_WINDOW_DAYS} days.`,
}
