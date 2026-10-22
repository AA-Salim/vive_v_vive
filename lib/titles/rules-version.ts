// Which title rules the database runs. Version 2 (supabase/phase10_title-effects.sql once title_sets exists) brings
// expiring titles, stronger effects, set bonuses, bigger perk caps and the lenient loadout. The app ships before
// the migration, so everything starts on version 1 and switches once the server sees the new schema: the server
// probes it (lib/titles/rules-probe.ts) and every titles response tells the browser.
export type TitleRulesVersion = 1 | 2

export const TITLE_RULES_HEADER = "x-title-rules"

let current: TitleRulesVersion = 1
const listeners = new Set<() => void>()

export function titleRulesVersion(): TitleRulesVersion {
  return current
}

// Bought titles expire, sets and the version 2 numbers apply.
export function titleRulesV2(): boolean {
  return current >= 2
}

export function parseTitleRules(value: unknown): TitleRulesVersion | null {
  const n = Number(value)
  return n === 1 || n === 2 ? n : null
}

export function setTitleRulesVersion(next: TitleRulesVersion | null | undefined): void {
  if (!next || next === current) return
  current = next
  for (const listener of listeners) listener()
}

export function subscribeTitleRules(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

// The value for one rule under each version.
export function byRules<T>(v1: T, v2: T): T {
  return current >= 2 ? v2 : v1
}
