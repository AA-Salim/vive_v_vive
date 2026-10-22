// One line of storytelling per chapter; unknown future acts fall back to their own subtitle.
const LORE: Record<number, string> = {
  1: "Le Bon Salaxe sat on the throne. The Charamil kissed his hand for points and thanked him for the privilege.",
  2: "The crown slipped. The king lost a Baron in 0.3 seconds and his dignity soon after. Now he writes names in a little notebook.",
}

export function actLore(number: number, subtitle: string | null): string {
  return LORE[number] ?? (subtitle ? `${subtitle}. The scribes are still writing.` : "The scribes are still writing.")
}

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]

export const romanOf = (n: number) => ROMAN[n] ?? String(n)
