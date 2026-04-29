const KISS_RESPONSES = [
  "The King acknowledges your groveling.",
  "Le Bon Salaxe barely felt that. Try harder next time.",
  "Your lips are unworthy, but your devotion is noted.",
  "Chalaksse grants you +1 point. Do not spend it foolishly.",
  "The Royal Hand has been kissed. The kingdom rejoices.",
  "SLX wipes His hand on His royal cloak. +1 for your trouble.",
  "Your devotion has been recorded in the royal archives.",
  "Chklat is mildly pleased. Mildly.",
  "The Royal Hand trembles -- not from your kiss, but from holding too many trophies.",
  "Another subject humbles themselves. As they should.",
  "EL Salaxino Goblino accepts your tribute.",
  "Chalakssinoss nods. That is the highest honor you will ever receive.",
  "Salaxe Le Genereux rewards loyalty. Barely.",
  "The Great Salaxe has felt worthier kisses, but yours will do.",
]

export function getRandomKissResponse(): string {
  return KISS_RESPONSES[Math.floor(Math.random() * KISS_RESPONSES.length)]
}
