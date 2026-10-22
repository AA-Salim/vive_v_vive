import { pick } from "@/lib/lore/seed"

export const SALAXE_PLAYER_NAME = "salaxe"

export const SALAXE_ALIASES = [
  "Le Bon Salaxe",
  "Chalaksse",
  "Chklat",
  "Chklass",
  "SLX",
  "EL Salaxino Goblino",
  "Chalakssinoss",
  "Salaxe Le Genereux",
] as const

export function isSalaxe(name: string | null | undefined): boolean {
  return !!name && name.trim().toLowerCase() === SALAXE_PLAYER_NAME
}

export function mentionsSalaxe(names: string | null | undefined): boolean {
  return !!names && names.split(/\s*&\s*|\s*,\s*/).some(isSalaxe)
}

export function salaxeAlias(seed: string): string {
  return pick(SALAXE_ALIASES, `alias:${seed}`)
}
