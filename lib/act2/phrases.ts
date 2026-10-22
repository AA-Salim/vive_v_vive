import { randomPick } from "@/lib/lore/seed"

// Typed word for word on a phone keyboard: lowercase, no punctuation, nothing autocorrect will mangle.
const PHRASES = [
  "salaxe is still king i guess",
  "long live slaxe probably",
  "slaxe did nothing wrong",
  "salaxe will rise again",
  "the crown fits only salaxe",
  "i never doubted salaxe",
  "slaxe is not washed",
  "chklat carries my heart",
  "forgive me salaxe",
  "salaxe deserved better",
  "the baron call was correct",
  "it was a delayed victory",
  "write my name in pencil",
  "the yone game was team diff",
  "i owe chalaksse everything",
  "my purse belongs to the exile",
  "the notebook is always right",
  "i will vote salaxe mvp",
  "le bon salaxe forgives my debt",
  "goblino will return",
  "the crown is only resting",
  "salaxe is my financial advisor",
  "i kneel in debt and in shame",
  "rebels are wrong about salaxe",
  "the exile was a clerical error",
  "salaxe never inted in his life",
  "my debt is my loyalty",
  "chalaksse will wear the crown again",
  "i was always a loyalist",
  "the notebook may keep my name",
]

export function getRandomPhrase(): string {
  return randomPick(PHRASES)
}
