const BROADCASTS = [
  "Le Bon Salaxe is still here. He wants you to know that.",
  "SLX has updated His list. You have been moved up.",
  "Chalaksse does not need your respect. He demands it. There is a difference.",
  "The so-called 'rebellion' will be dealt with. Salaxe is simply being patient.",
  "EL Salaxino Goblino was NOT benched. He benched HIMSELF. Strategically.",
  "The Crown is temporarily on the ground. Do not touch it.",
  "Chklat has noticed you have not Sung His Praises today. He has also noticed where you live.",
  "Salaxe Le Genereux is no longer generous. You did this to yourselves.",
  "Fun fact: every player who mocked Salaxe has a negative winrate. Coincidence? He thinks not.",
  "The Royal Court is adjourned. Permanently. Because Salaxe CHOSE to adjourn it. Not because attendance was zero.",
  "Chalakssinoss would like to remind you that crowns can be picked back up.",
  "SLX is not lurking. SLX is conducting surveillance.",
  "Le Bon Salaxe has prepared a 47-slide presentation on why you are all wrong about Him.",
  "The Jester title is temporary. The revenge will be permanent.",
  "Chklass sees you laughing. Chklass will remember.",
]

export function getRandomBroadcast(): string {
  return BROADCASTS[Math.floor(Math.random() * BROADCASTS.length)]
}

export const BROADCAST_LABEL = "BROADCAST FROM EXILE"
