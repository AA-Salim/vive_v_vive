import { randomPick } from "@/lib/lore/seed"

const KISS_RESPONSES = [
  "The King acknowledges your groveling. Barely.",
  "Le Bon Salaxe barely felt that. Put some heart into it.",
  "Your lips are unworthy, but your devotion has been logged.",
  "SLX wipes His hand on the royal cloak. Discreetly. Mostly.",
  "The royal hand has been kissed. Somewhere, a bard starts writing.",
  "Your devotion is recorded in the royal archives, under \"Promising Peasants\".",
  "Chklat is mildly pleased. Mildly. Do not push it.",
  "The royal hand trembles. Not from your kiss. From carrying every game.",
  "Another subject humbles themselves. As foretold.",
  "EL Salaxino Goblino accepts your tribute and asks you to work on your technique.",
  "Chalakssinoss nods. That is the highest honor available today.",
  "Salaxe Le Genereux rewards loyalty. Generously. By His own definition.",
  "The Great Salaxe has felt worthier kisses. He has also felt worse. Yours was in the middle.",
  "The royal hand is now 2% shinier. Keep going.",
  "A fine kiss. Not Smite-steal fine. But fine.",
  "The court applauds politely. The jungler pretends he did not see.",
  "Le Bon Salaxe adds you to the guest list. Not the good one. The one by the door.",
  "Your kiss has been received, reviewed and graded: C+. Shows promise.",
  "SLX smiles. Somewhere, a minion wave crashes perfectly into a tower.",
  "Merci, peasant. The King will remember this. For about a day.",
  "The hand is kissed, the kingdom rejoices, the treasury pays. Life is simple under Salaxe.",
  "Chalaksse sighs contentedly. You have bought yourself one ward of goodwill.",
  "That kiss was so sincere the King almost believed it. Almost.",
  "Noblesse oblige: the King accepts your devotion and pretends to be surprised.",
]

const KISS_DESCRIPTIONS = [
  "The Royal Hand awaits. Prove your loyalty to Chalaksse, one respectful kiss at a time.",
  "Show your devotion to Le Grand Salaxe. The treasury rewards every humble pucker.",
  "Chklat demands tribute. Lips only. This is a royal court.",
  "EL Salaxino Goblino extends His hand. It has carried many games. Kiss it like you mean it.",
  "The Great Salaxe permits you to approach. Mind the steps. Mind your manners.",
  "SLX offers His hand. You know what to do. Everyone knows what to do.",
  "Salaxe Le Genereux lets you earn your keep. A few kisses a day, as the law commands.",
  "Le Bon Salaxe's hand grows cold. Warm it with devotion, get paid in royal coin.",
  "The King's hand is outstretched. This is an honor, not a request. It is also a request.",
  "Kneel, kiss, collect. The oldest economy on the Rift.",
  "Chalakssinoss holds court. Every kiss is noted, every kisser rewarded, every absence remembered.",
  "Royal etiquette: kneel first, kiss second, never ask about the jungle.",
]

export function getRandomKissResponse(): string {
  return randomPick(KISS_RESPONSES)
}

export function getRandomKissDescription(): string {
  return randomPick(KISS_DESCRIPTIONS)
}
