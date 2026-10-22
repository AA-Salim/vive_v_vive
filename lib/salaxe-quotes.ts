import type { DailyQuote } from "@/lib/lore/daily"
import { pick, randomPick } from "@/lib/lore/seed"

export const ACT1_QUOTES: readonly DailyQuote[] = [
  {
    title: "A Royal Decree",
    body: (u) =>
      `Le Bon Salaxe, First of His Name, Breaker of Lanes and Taker of Every Kill, has gazed upon ${u} and found them barely worth the ink. Five points. Kneel on your way out.`,
    dismiss: "I Am Not Worthy",
  },
  {
    title: "The Benevolent Chalaksse",
    body: (u) =>
      `By the grace of Chalaksse, Lord of the Rift and Owner of Every Blue Buff, ${u} receives five points. Do not ask why. Generosity does not explain itself.`,
    dismiss: "Thank You, My Lord",
  },
  {
    title: "The Salaxe Provides",
    body: (u) =>
      `Each sunrise the King asks Himself: "Shall I feed ${u} today?" The answer is always yes. Not because they deserve it. Because a hungry peasant kisses with less enthusiasm.`,
    dismiss: "I Shall Kiss Harder",
  },
  {
    title: "Le Grand Salaxe Descends",
    body: (u) =>
      `Salaxe, Le Grand, Le Bon, Le Magnifique, has descended from the throne to hand ${u} five points personally. Well, through an intermediary. Well, through a database.`,
    dismiss: "Bless the Database",
  },
  {
    title: "The Royal Tax Refund",
    body: (u) =>
      `In an act of fiscal magnanimity, the Crown returns five points to ${u}. This is not socialism. This is Salaxe-ism. You take what He gives and you say merci.`,
    dismiss: "Merci, Sire",
  },
  {
    title: "The King Sees All",
    body: (u) =>
      `Chklat has reviewed ${u}'s match history. He has questions. He will not ask them. He will grant five points and let the shame do its work.`,
    dismiss: "The Shame Is Working",
  },
  {
    title: "A Blessing From the Throne",
    body: (u) =>
      `Let the chronicles record that on this day Chalakssinoss, Who Carries Every Game, granted ${u} five points. Historians will weep. The jungler will claim he helped. He did not.`,
    dismiss: "The Jungler Did Not Help",
  },
  {
    title: "Kneel Before SLX",
    body: (u) =>
      `${u}. Yes, you. SLX has acknowledged your existence. That should be reward enough, but His heart is as deep as His champion pool, so here are five points. Now leave His sight.`,
    dismiss: "I Leave His Sight",
  },
  {
    title: "Leftovers From the Feast",
    body: (u) =>
      `The royal kitchens had five points left over from the feast. The King thought of the dogs, then of ${u}, and after a long and honest debate, chose ${u}. Congratulations.`,
    dismiss: "I Beat the Dogs",
  },
  {
    title: "The Treasury Opens",
    body: (u) =>
      `Salaxe Le Genereux, Whose Generosity Knows No Bounds (but Whose Patience Does), opens the vault for ${u}. Five points fall like crumbs from the royal table. Scramble.`,
    dismiss: "I Scramble Gratefully",
  },
  {
    title: "Smite of Generosity",
    body: (u) =>
      `The King has Smited the daily objective of generosity and secured five points for ${u}. Nobody contested it. Nobody ever contests the King.`,
    dismiss: "Nobody Contests the King",
  },
  {
    title: "A Merciful Act",
    body: (u) =>
      `In a rare moment of mercy that will echo down every lane, EL Salaxino Goblino lets ${u} exist for another day, with five points for snacks. Remember who feeds you.`,
    dismiss: "You Feed Me, My King",
  },
  {
    title: "The Court Is in Session",
    body: (u) =>
      `All rise for the morning stipend. ${u} is called before the throne, handed five points, and dismissed before they can mention the jungle.`,
    dismiss: "I Mention Nothing",
  },
  {
    title: "The Weight of the Crown",
    body: (u) =>
      `The crown is heavy, the throne is cold, and the royal hand is sore from all the kissing. Still, He finds the strength to give ${u} five points. Truly, the burden of greatness.`,
    dismiss: "Such Burden, Sire",
  },
]

export function getRandomQuote(): DailyQuote {
  return randomPick(ACT1_QUOTES)
}

export function getDailyQuote(seed: string): DailyQuote {
  return pick(ACT1_QUOTES, `daily:${seed}`)
}
