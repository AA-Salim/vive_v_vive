const PHRASES = [
  "hail slaxe le bon",
  "slaxe is my king",
  "i kneel before lebonsalaxe",
  "salaxe owns my soul",
  "all glory to chklat",
  "slaxe carries every game",
  "i am nothing without slaxe",
  "lebonsalaxe is the greatest",
  "long live slaxe",
  "slaxe the magnificent",
  "i bow to salaxe",
  "chklat rules us all",
  "slaxe forgive my debt",
  "praise be to lebonsalaxe",
  "slaxe is the one true carry",
]

export function getRandomPhrase(): string {
  return PHRASES[Math.floor(Math.random() * PHRASES.length)]
}
