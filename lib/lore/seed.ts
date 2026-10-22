// Deterministic picking: the same seed gives the same line on every client and every refetch.

export function hashSeed(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pickIndex(length: number, seed: string): number {
  return length > 0 ? hashSeed(seed) % length : 0
}

export function pick<T>(items: readonly T[], seed: string): T {
  return items[pickIndex(items.length, seed)]
}

export function randomPick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match))
}
