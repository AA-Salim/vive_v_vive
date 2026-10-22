import type { HelpEntry } from "@/lib/help"
import { LOADOUT_TIERS, type TierSpec } from "@/lib/profiles/loadout"
import { PROFILE_RULES, type LoadoutTitle } from "@/lib/profiles/types"
import { CATEGORY_META, RARITY_LABEL } from "@/lib/titles/catalog"
import type { TitleCategory } from "@/lib/titles/types"

const READING = "Nothing. Reading another noble's file is free."

export const PROFILE_HELP = {
  winRate: {
    title: "Win rate",
    does: "Share of games won in the chosen season. Dice, lanes and teammates all included, no excuses filed.",
    cost: READING,
    limits: `Under ${PROFILE_RULES.rateMinGames} games it is a rumour, not a record: it shows, but the court's records ignore it.`,
  },
  rank: {
    title: "Treasury rank",
    does: "Where this purse sits on the leaderboard, ranked by point balance. Equal purses share a rank.",
    cost: READING,
    limits: "Only players with a linked Discord account have a purse. Archived acts show the final standings.",
  },
  praise: {
    title: "Devotion",
    does: "Verses sung for Salaxe plus hands kissed back when he still had a throne, in the chosen season.",
    cost: READING,
  },
  duo: {
    title: "Soulmate and nemesis",
    does: "Soulmate: the teammate with the best win rate together. Nemesis: the foe who beat this player the most.",
    cost: READING,
    limits: `Needs at least ${PROFILE_RULES.duoMinGames} games together, or ${PROFILE_RULES.rivalMinGames} against, in the chosen season. Long seasons raise the bar to a twelfth of all games played.`,
  },
  loadout: {
    title: "Banner loadout",
    does: "The titles this player wears into battle. Perks pay out on their own; curses cost their wearer.",
    cost: READING,
    limits: LOADOUT_TIERS.map((t) => `${t.slots} ${t.label.toLowerCase()} (${t.rarities})`).join(", ") + ".",
  },
  curses: {
    title: "Marks of shame",
    does: "Mockery titles branded on this player by someone else. They burn for a number of games, then go cold.",
    cost: "The wearer pays tribute to whoever branded them while the curse burns.",
  },
} satisfies Record<string, HelpEntry>

export function titleHelp(title: LoadoutTitle, tier: TierSpec): HelpEntry {
  const category = CATEGORY_META[title.category as TitleCategory]?.label
  const kind = title.kind === "cosmetic" ? "Pure vanity, no perk attached." : null
  return {
    title: title.name,
    does: title.effect ?? title.perk ?? kind ?? "The scribes have no notes on this one.",
    cost: title.kind === "curse" && title.perk ? title.perk : "Nothing per game.",
    reward: title.kind === "perk" && title.perk && title.perk !== title.effect ? title.perk : undefined,
    limits: [RARITY_LABEL[title.rarity], category, `${tier.label} slot`].filter(Boolean).join(" · "),
  }
}
