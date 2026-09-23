const PHRASES = [
  "salaxe is still king i guess",
  "long live slaxe probably",
  "slaxe did nothing wrong",
  "salaxe will rise again",
  "the crown fits only salaxe",
  "i never doubted slaxe ever",
  "slaxe is not washed",
  "chklat carries my heart",
  "forgive me salaxe",
  "salaxe deserved better",
]

export function getRandomPhrase(): string {
  return PHRASES[Math.floor(Math.random() * PHRASES.length)]
}
