import { randomPick } from "@/lib/lore/seed"

// Typed word for word on a phone keyboard: lowercase, no punctuation, nothing autocorrect will mangle.
const PHRASES = [
  "hail salaxe le bon",
  "slaxe is my king",
  "i kneel before le bon salaxe",
  "salaxe owns my soul",
  "all glory to chklat",
  "slaxe carries every game",
  "i am nothing without slaxe",
  "le bon salaxe is the greatest",
  "long live slaxe",
  "slaxe the magnificent",
  "i bow to salaxe",
  "chklat rules us all",
  "slaxe forgive my debt",
  "praise be to le bon salaxe",
  "slaxe is the one true carry",
  "my lips belong to the king",
  "the royal hand is always right",
  "i kiss therefore i am",
]

export function getRandomPhrase(): string {
  return randomPick(PHRASES)
}
