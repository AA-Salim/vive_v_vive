const BROADCASTS = [
  "Big Salaxe is watching.",
  "The King is in good health. Long may He reign.",
  "All lanes belong to Chalaksse.",
  "Le Bon Salaxe reminds you: you are replaceable.",
  "The Royal Treasury is full. Yours is not.",
  "Chklat has won another game. As expected.",
  "A moment of silence for those who dared oppose EL Salaxino Goblino.",
  "The King's KDA this week: immeasurable.",
  "SLX does not make mistakes. He creates learning opportunities for others.",
  "Royal Decree: all peasants must touch grass between games.",
  "Chalakssinoss's champion pool is deeper than your understanding of the game.",
  "The Crown is heavy. But Salaxe Le Genereux carries it effortlessly.",
  "Today's forecast: 100% chance of Chalaksse dominance.",
  "Le Bon Salaxe has graciously allowed you to continue using this app.",
  "Remember: every point you earn was made possible by The Great Salaxe's generosity.",
  "The King sees your match history. The King is disappointed.",
  "SLX does not int. SLX strategically redistributes gold.",
  "Fun fact: Chalaksse has never lost. Only experienced delayed victories.",
  "The Royal Court is now in session. Behave accordingly.",
  "Chklat's winrate is classified information. For your own protection.",
  "EL Salaxino Goblino does not gank. He arrives.",
  "Chalakssinoss once looked at Baron. Baron surrendered.",
]

export function getRandomBroadcast(): string {
  return BROADCASTS[Math.floor(Math.random() * BROADCASTS.length)]
}
