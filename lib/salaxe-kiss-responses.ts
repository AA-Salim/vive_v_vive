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

const KISS_DESCRIPTIONS = [
  "Show your devotion to Le Grand Salaxe. Each kiss earns you +1 point.",
  "The Royal Hand awaits. Prove your loyalty to Chalaksse.",
  "Chklat demands tribute. +1 point per act of groveling.",
  "EL Salaxino Goblino extends His hand. Will you kiss it?",
  "The Great Salaxe permits you to approach. +1 point for your courage.",
  "Chalakssinoss awaits your devotion. Do not disappoint Him.",
  "SLX offers His hand. You know what to do.",
  "Salaxe Le Genereux allows you to earn +1 point. Be grateful.",
  "Le Bon Salaxe's hand grows cold. Warm it with your devotion.",
  "The King's hand is outstretched. This is an honor, not a request.",
]

export function getRandomKissResponse(): string {
  return KISS_RESPONSES[Math.floor(Math.random() * KISS_RESPONSES.length)]
}

export function getRandomKissDescription(): string {
  return KISS_DESCRIPTIONS[Math.floor(Math.random() * KISS_DESCRIPTIONS.length)]
}
