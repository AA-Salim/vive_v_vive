import { randomPick } from "@/lib/lore/seed"

export const ACT1_BROADCASTS: readonly string[] = [
  "Big Salaxe is watching. He has excellent vision. He bought it with your kisses.",
  "The King is in good health. Long may He carry.",
  "All lanes belong to Chalaksse. He lets you borrow them.",
  "Le Bon Salaxe reminds you: you are replaceable. He is not.",
  "The Royal Treasury is full. Your purse is not. Coincidence is a peasant word.",
  "Chklat has won another game. As foretold. As written. By Chklat.",
  "A moment of silence for those who opposed EL Salaxino Goblino. Their KDA never recovered.",
  "The King's KDA this week: immeasurable. The scribes ran out of paper.",
  "SLX does not make mistakes. He creates learning opportunities for others.",
  "Royal decree: all peasants must touch grass between games. The King will remain indoors, ruling.",
  "Chalakssinoss's champion pool is deeper than your understanding of the game. His wards are deeper still.",
  "The crown is heavy. Salaxe Le Genereux carries it the way He carries every game: effortlessly, and loudly.",
  "Today's forecast: 100% chance of Chalaksse dominance, with scattered kisses in the afternoon.",
  "Every point you own was minted by The Great Salaxe. Spend them in His honor.",
  "The King has seen your match history. The King is disappointed. The King will kiss it better. For a fee.",
  "SLX does not int. SLX strategically redistributes gold to keep the game interesting.",
  "Fun fact: Chalaksse has never lost. He has only experienced delayed victories.",
  "The Royal Court is in session. Wipe your feet. Kiss the hand. In that order.",
  "Chklat's win rate is classified. For your own protection.",
  "EL Salaxino Goblino does not gank. He arrives, and the lane surrenders.",
  "Chalakssinoss once looked at Baron. Baron surrendered. Probably. Nobody checked.",
  "The King has pinged Baron. Follow Him. What could possibly go wrong.",
  "Royal reminder: the hand does not kiss itself.",
  "Le Bon Salaxe graciously allows you to keep using this app. Act accordingly.",
]

export function getRandomBroadcast(): string {
  return randomPick(ACT1_BROADCASTS)
}
