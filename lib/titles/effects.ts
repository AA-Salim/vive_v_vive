import { BET_RULES } from "@/lib/betting/rules"
import { WAGER_BASE_MULTIPLIER, WAGER_MAX_MULTIPLIER } from "@/lib/chaos/catalog"
import { DUEL_RULES } from "@/lib/duels/rules"
import { DAILY_STIPEND } from "@/lib/lore/daily"
import { PRAISE_REWARD, ROYAL_FAVOR } from "@/lib/praise/rules"

// Immediate title effects: they change what an action costs or pays the moment it is taken, on top of the post-game
// perks in lib/titles/perks.ts. Mirrored in supabase/phase10_title-effects.sql (title_effect_keys, title_effects,
// title_conflicts and the vvv_title_* helpers): keep both in lockstep.
//
// Sources: every equipped self title, plus every brand (mockery curse) still burning. Several sources can feed one
// key; the sum is clamped to the key's range, so combinations are strong but bounded.

export type EffectKey =
  | "decree_extra_uses"
  | "decree_cost_pct"
  | "decree_cost_salaxe_pct"
  | "decree_cost_target_pct"
  | "exile_immune"
  | "wager_base_bonus"
  | "early_window_bonus_s"
  | "all_in_bonus_pct"
  | "insurance_coverage_bonus"
  | "insurance_premium_salaxe_pct"
  | "insurance_blocked"
  | "bet_cap"
  | "praise_bonus_pct"
  | "favor_bonus_pct"
  | "stipend_bonus_pct"
  | "stipend_to_salaxe"
  | "bestow_cost_pct"
  | "duel_tithe_pct"
  | "duel_loss_refund_pct"
  | "herald"

export type EffectDomain = "decrees" | "betting" | "praise" | "duels" | "court"

export const EFFECT_DOMAINS: readonly EffectDomain[] = ["decrees", "betting", "praise", "duels", "court"]

export const DOMAIN_LABEL: Record<EffectDomain, string> = {
  decrees: "Decrees",
  betting: "Betting",
  praise: "Praise",
  duels: "Duels",
  court: "Court",
}

export type EffectMode = "sum" | "min" | "flag"

// The total of every decree modifier (own, against Salaxe, against a carpeted target) stays in this range.
export const DECREE_COST_RANGE = { min: -30, max: 50 } as const

export { WAGER_MAX_MULTIPLIER }

const signedPct = (v: number) => `${v > 0 ? "+" : "-"}${Math.abs(v)}%`
const off = (v: number) => `${Math.abs(v)}%`
const scaled = (base: number, pct: number) => Math.round((base * (100 + pct)) / 100)
const multiplierText = (v: number) => `x${Number.isInteger(v) ? v : v.toFixed(1)}`

interface KeyDef {
  mode: EffectMode
  min: number
  max: number
  domain: EffectDomain
  // What the effect does at this value, in one sentence.
  describe: (value: number) => string
  // Compact form for chips next to a price: "-20%", "x2.2", "+1 use".
  chip: (value: number) => string
  // Line written into responses, events and ledgers once the effect actually changed an amount.
  applied: (value: number, subject?: string | null) => string
  // How far several titles can push the key together.
  stacking: string
}

export const EFFECT_KEYS: Record<EffectKey, KeyDef> = {
  decree_extra_uses: {
    mode: "sum",
    min: 0,
    max: 1,
    domain: "decrees",
    describe: (v) => `+${v} use of every limited Royal Decree per game`,
    chip: (v) => `+${v} use`,
    applied: () => "extra decree use",
    stacking: "Never more than +1 use per decree.",
  },
  decree_cost_pct: {
    mode: "sum",
    min: DECREE_COST_RANGE.min,
    max: DECREE_COST_RANGE.max,
    domain: "decrees",
    describe: (v) => `Your Royal Decrees cost ${off(v)} ${v > 0 ? "more" : "less"} (the King's Wager stake never changes)`,
    chip: signedPct,
    applied: (v) => `${signedPct(v)} on this decree`,
    stacking: `Every decree discount stacks up to ${off(DECREE_COST_RANGE.min)} off; markups up to +${DECREE_COST_RANGE.max}%.`,
  },
  decree_cost_salaxe_pct: {
    mode: "sum",
    min: -20,
    max: 0,
    domain: "decrees",
    describe: (v) => `Decrees aimed at Salaxe or his team cost ${off(v)} less`,
    chip: (v) => `${signedPct(v)} vs Salaxe`,
    applied: (v) => `${signedPct(v)} on this decree, aimed at Salaxe`,
    stacking: `Stacks with other decree discounts up to ${off(DECREE_COST_RANGE.min)} off.`,
  },
  decree_cost_target_pct: {
    mode: "sum",
    min: -20,
    max: 0,
    domain: "decrees",
    describe: (v) => `Decrees aimed at you cost everyone else ${off(v)} less`,
    chip: (v) => `${signedPct(v)} on you`,
    applied: (v, subject) => `${signedPct(v)} on this decree, aimed at ${subject ?? "a carpet"}`,
    stacking: `Stacks with the caster's discounts up to ${off(DECREE_COST_RANGE.min)} off.`,
  },
  exile_immune: {
    mode: "flag",
    min: 0,
    max: 1,
    domain: "decrees",
    describe: () => "Nobody can exile your champion (Exile a Champion bounces off your seat)",
    chip: () => "Exile-proof",
    applied: (_v, subject) => `${subject ?? "this seat"} cannot be exiled`,
    stacking: "On or off.",
  },
  wager_base_bonus: {
    mode: "sum",
    min: 0,
    max: 0.2,
    domain: "decrees",
    describe: (v) =>
      `Your King's Wager starts at ${multiplierText(WAGER_BASE_MULTIPLIER + v)} instead of ${multiplierText(WAGER_BASE_MULTIPLIER)}`,
    chip: (v) => multiplierText(WAGER_BASE_MULTIPLIER + v),
    applied: (v) => `wager starts at ${multiplierText(WAGER_BASE_MULTIPLIER + v)}`,
    stacking: `Never above the ${multiplierText(WAGER_MAX_MULTIPLIER)} cap of every wager.`,
  },
  early_window_bonus_s: {
    mode: "sum",
    min: 0,
    max: 30,
    domain: "betting",
    describe: (v) =>
      `Your early-conviction boost window lasts ${BET_RULES.earlySeconds + v} s instead of ${BET_RULES.earlySeconds} s`,
    chip: (v) => `${BET_RULES.earlySeconds + v} s early`,
    applied: (v) => `early conviction until ${BET_RULES.earlySeconds + v} s`,
    stacking: "Never more than +30 s.",
  },
  all_in_bonus_pct: {
    mode: "sum",
    min: 0,
    max: 10,
    domain: "betting",
    describe: (v) =>
      `Your all-in bonus pays +${BET_RULES.allInBonusPct + v}% of the profit instead of +${BET_RULES.allInBonusPct}%`,
    chip: (v) => `All-in +${BET_RULES.allInBonusPct + v}%`,
    applied: (v) => `all-in bonus +${BET_RULES.allInBonusPct + v}%`,
    stacking: "Never more than +10 points of bonus.",
  },
  insurance_coverage_bonus: {
    mode: "sum",
    min: 0,
    max: 15,
    domain: "betting",
    describe: (v) => `Guardian Angel covers ${BET_RULES.coveragePct + v}% of your stake instead of ${BET_RULES.coveragePct}%`,
    chip: (v) => `${BET_RULES.coveragePct + v}% cover`,
    applied: (v) => `covered at ${BET_RULES.coveragePct + v}%`,
    stacking: `Coverage never goes above ${BET_RULES.coveragePct + 15}%.`,
  },
  insurance_premium_salaxe_pct: {
    mode: "sum",
    min: -25,
    max: 0,
    domain: "betting",
    describe: (v) =>
      `Guardian Angel costs ${off(v)} less on bets on Salaxe's side (from ${Math.ceil((BET_RULES.premiumPct * (100 + v)) / 100)}% instead of ${BET_RULES.premiumPct}%)`,
    chip: (v) => `${signedPct(v)} premium`,
    applied: (v) => `${signedPct(v)} premium on Salaxe's side`,
    stacking: "Never more than 25% off the premium.",
  },
  insurance_blocked: {
    mode: "flag",
    min: 0,
    max: 1,
    domain: "betting",
    describe: () => "No Guardian Angel for you: insurance is refused on every bet",
    chip: () => "No insurance",
    applied: () => "insurance refused",
    stacking: "Beats every insurance perk you wear.",
  },
  bet_cap: {
    mode: "min",
    min: 1,
    max: BET_RULES.maxStake,
    domain: "betting",
    describe: (v) => `Your bets are capped at ${v} points per game (all-in included)`,
    chip: (v) => `Max ${v} a game`,
    applied: (v) => `bets capped at ${v} a game`,
    stacking: "The lowest cap wins, whatever else you wear.",
  },
  praise_bonus_pct: {
    mode: "sum",
    min: 0,
    max: 40,
    domain: "praise",
    describe: (v) => `Your written praise pays +${v}% (${scaled(PRAISE_REWARD, v)} instead of ${PRAISE_REWARD})`,
    chip: (v) => `+${v}% praise`,
    applied: (v) => `+${v}% on this praise`,
    stacking: "Praise bonuses stack up to +40%.",
  },
  favor_bonus_pct: {
    mode: "sum",
    min: 0,
    max: 50,
    domain: "praise",
    describe: (v) =>
      `Royal Favor pays +${v}% when Salaxe crowns your praise (${scaled(ROYAL_FAVOR, v)} instead of ${ROYAL_FAVOR})`,
    chip: (v) => `+${v}% favor`,
    applied: (v) => `+${v}% Royal Favor`,
    stacking: "Favor bonuses stack up to +50%.",
  },
  stipend_bonus_pct: {
    mode: "sum",
    min: 0,
    max: 100,
    domain: "court",
    describe: (v) =>
      `Your daily stipend ${v === 100 ? "is doubled" : `pays +${v}%`} (${scaled(DAILY_STIPEND, v)} instead of ${DAILY_STIPEND})`,
    chip: (v) => (v === 100 ? "x2 stipend" : `+${v}% stipend`),
    applied: (v) => (v === 100 ? "x2 stipend" : `+${v}% stipend`),
    stacking: "Never more than double.",
  },
  stipend_to_salaxe: {
    mode: "flag",
    min: 0,
    max: 1,
    domain: "court",
    describe: () => "Your daily stipend is paid to Salaxe instead of you",
    chip: () => "Stipend to Salaxe",
    applied: () => "stipend paid to Salaxe",
    stacking: "Beats every stipend bonus: Salaxe pockets the bigger stipend.",
  },
  bestow_cost_pct: {
    mode: "sum",
    min: -30,
    max: 0,
    domain: "court",
    describe: (v) => `Bestowing a curse on someone costs you ${off(v)} less`,
    chip: (v) => `${signedPct(v)} curses`,
    applied: (v) => `${signedPct(v)} on this curse`,
    stacking: "Curse discounts stack up to 30% off.",
  },
  duel_tithe_pct: {
    mode: "sum",
    min: -50,
    max: 0,
    domain: "duels",
    describe: (v) =>
      `Your duel tithe is ${v === -50 ? "halved" : `${off(v)} lower`} (${(DUEL_RULES.taxPct * (100 + v)) / 100}% of the winnings instead of ${DUEL_RULES.taxPct}%)`,
    chip: (v) => (v === -50 ? "Tithe halved" : `Tithe ${signedPct(v)}`),
    applied: (v) => (v === -50 ? "tithe halved" : `tithe ${signedPct(v)}`),
    stacking: "The tithe never drops below half.",
  },
  duel_loss_refund_pct: {
    mode: "sum",
    min: 0,
    max: 20,
    domain: "duels",
    describe: (v) => `Lose a duel and ${v}% of your stake comes back`,
    chip: (v) => `${v}% back if you lose`,
    applied: (v) => `${v}% of the stake back`,
    stacking: "Never more than 20% back.",
  },
  herald: {
    mode: "flag",
    min: 0,
    max: 1,
    domain: "court",
    describe: () => "The Herald announces every bet, decree and duel you make, live, to the whole court",
    chip: () => "Herald",
    applied: () => "announced by the Herald",
    stacking: "On or off.",
  },
}

export const EFFECT_KEY_LIST = Object.keys(EFFECT_KEYS) as EffectKey[]

export type TitleEffectTable = Readonly<Record<string, Partial<Record<EffectKey, number>>>>

// Shop titles, curses, and two milestone families (decrees cast, praises sung) whose effects stack.
export const TITLE_EFFECTS: TitleEffectTable = {
  "The Usurper": { decree_extra_uses: 1 },
  Kingslayer: { decree_cost_salaxe_pct: -20 },
  "Crown Thief": { early_window_bonus_s: 30 },
  "The Disrespector": { bestow_cost_pct: -20 },
  "The One Who Stopped Kneeling": { exile_immune: 1 },
  "Last Loyalist": { praise_bonus_pct: 25 },
  "Still Kneeling": { stipend_bonus_pct: 100 },
  "Throne Polisher": { favor_bonus_pct: 50 },
  "The Holdout": { insurance_premium_salaxe_pct: -25 },
  "Copium Dealer": { insurance_coverage_bonus: 15 },
  "Baron Caller (Derogatory)": { wager_base_bonus: 0.2 },
  "El Goblino Pequeno": { duel_tithe_pct: -50 },
  "Main Character (Self-Diagnosed)": { herald: 1 },
  "The 0/8 Powerspike": { all_in_bonus_pct: 10 },
  "Delayed Victory Specialist": { duel_loss_refund_pct: 20 },

  "Court Jester": { bet_cap: 50 },
  "Boot Licker": { decree_cost_pct: 20 },
  "Royal Carpet": { decree_cost_target_pct: -20 },
  "Salaxe's Emotional Support": { stipend_to_salaxe: 1 },
  "The Crawling One": { insurance_blocked: 1 },

  "Mischief Maker": { decree_cost_pct: -3 },
  "Chaos Enjoyer": { decree_cost_pct: -5 },
  "Chaos Incarnate": { decree_cost_pct: -7 },
  "Salaxe Appreciator": { praise_bonus_pct: 5 },
  "Devoted Servant": { praise_bonus_pct: 5 },
  "Down Horrendous For Salaxe": { praise_bonus_pct: 10 },
}

export interface TitleEffectLine {
  key: EffectKey
  value: number
  domain: EffectDomain
  text: string
  chip: string
  stacking: string
}

export function titleEffects(name: string): TitleEffectLine[] {
  const table = TITLE_EFFECTS[name]
  if (!table) return []
  return (Object.entries(table) as [EffectKey, number][]).map(([key, value]) => {
    const def = EFFECT_KEYS[key]
    return { key, value, domain: def.domain, text: def.describe(value), chip: def.chip(value), stacking: def.stacking }
  })
}

export function titleDomain(name: string): EffectDomain | null {
  return titleEffects(name)[0]?.domain ?? null
}

export function effectSummary(name: string): string | null {
  const lines = titleEffects(name)
  return lines.length ? lines.map((l) => l.text).join(". ") : null
}

// ============================================================
// Combining sources
// ============================================================

export type EffectSourceKind = "equipped" | "curse"

export interface EffectSource {
  title: string
  kind: EffectSourceKind
}

export interface CombinedEffect {
  key: EffectKey
  value: number
  raw: number
  capped: boolean
  sources: { title: string; kind: EffectSourceKind; value: number }[]
}

export type CombinedEffects = ReadonlyMap<EffectKey, CombinedEffect>

export const NO_EFFECTS: CombinedEffects = new Map()

// Curses only count while they burn and only self titles count when equipped: callers pass the live sources.
export function combineEffects(sources: readonly EffectSource[], table: TitleEffectTable = TITLE_EFFECTS): CombinedEffects {
  const out = new Map<EffectKey, CombinedEffect>()
  const seen = new Set<string>()
  for (const source of sources) {
    if (seen.has(source.title)) continue
    seen.add(source.title)
    for (const [key, value] of Object.entries(table[source.title] ?? {}) as [EffectKey, number][]) {
      const entry = out.get(key) ?? { key, value: 0, raw: 0, capped: false, sources: [] }
      entry.sources.push({ title: source.title, kind: source.kind, value })
      out.set(key, entry)
    }
  }
  for (const entry of out.values()) {
    const def = EFFECT_KEYS[entry.key]
    const values = entry.sources.map((s) => s.value)
    entry.raw = def.mode === "min" ? Math.min(...values) : def.mode === "flag" ? 1 : values.reduce((a, b) => a + b, 0)
    entry.value = def.mode === "flag" ? 1 : Math.min(def.max, Math.max(def.min, entry.raw))
    entry.capped = entry.value !== entry.raw
  }
  return out
}

export function fxValue(fx: CombinedEffects, key: EffectKey): number {
  return fx.get(key)?.value ?? 0
}

export function fxHas(fx: CombinedEffects, key: EffectKey): boolean {
  return fx.has(key)
}

export interface ComboLine {
  key: EffectKey
  domain: EffectDomain
  value: number
  text: string
  chip: string
  stacking: string
  capped: boolean
  cursed: boolean
  titles: string[]
}

// "This combo gives you": one line per key, at its combined, capped value.
export function comboLines(fx: CombinedEffects): ComboLine[] {
  return EFFECT_KEY_LIST.flatMap((key) => {
    const entry = fx.get(key)
    if (!entry) return []
    const def = EFFECT_KEYS[key]
    return [
      {
        key,
        domain: def.domain,
        value: entry.value,
        text: def.describe(entry.value),
        chip: def.chip(entry.value),
        stacking: def.stacking,
        capped: entry.capped,
        cursed: entry.sources.some((s) => s.kind === "curse"),
        titles: entry.sources.map((s) => s.title),
      },
    ]
  })
}

// ============================================================
// A loadout as served by GET /api/titles/equipped, summarized
// ============================================================

// Structurally an EquippedTitle: the worn titles and the brands still burning. Entries from before loadouts only name
// their primary title.
export interface LoadoutLike {
  loadout?: readonly { title: string; category: string }[]
  curses?: readonly { title: string }[]
  title?: string
  category?: string
  kind?: string
}

// Worn mockery titles are scars: only a burning brand acts.
export function loadoutSources(entry: LoadoutLike | null | undefined): EffectSource[] {
  if (!entry) return []
  const worn =
    entry.loadout ??
    (entry.kind !== "curse" && entry.title && entry.category ? [{ title: entry.title, category: entry.category }] : [])
  return [
    ...worn.filter((t) => t.category !== "mockery").map((t) => ({ title: t.title, kind: "equipped" as const })),
    ...(entry.curses ?? []).map((c) => ({ title: c.title, kind: "curse" as const })),
  ]
}

export interface LoadoutSummary {
  titles: number
  curses: number
  lines: ComboLine[]
  // One line for a profile or a player card: "+1 use · -8% · -20% vs Salaxe · x2.2 · No insurance".
  text: string
}

export function summarizeLoadout(entry: LoadoutLike | null | undefined): LoadoutSummary {
  const sources = loadoutSources(entry)
  const lines = comboLines(combineEffects(sources))
  return {
    titles: entry?.loadout?.length ?? sources.filter((s) => s.kind === "equipped").length,
    curses: entry?.curses?.length ?? 0,
    lines,
    text: lines.map((line) => line.chip).join(" · "),
  }
}

// ============================================================
// Notes: which title changed an amount. Same shape as the SQL helpers return.
// ============================================================

export interface EffectNote {
  title: string
  key: EffectKey
  value: number
  subject?: string | null
}

export function isEffectKey(value: unknown): value is EffectKey {
  return typeof value === "string" && value in EFFECT_KEYS
}

export function parseNotes(value: unknown): EffectNote[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const { title, key, value: v, subject } = item as Record<string, unknown>
    if (typeof title !== "string" || !isEffectKey(key)) return []
    const n = Number(v)
    return [{ title, key, value: Number.isFinite(n) ? n : 0, subject: typeof subject === "string" ? subject : null }]
  })
}

export function noteText(note: EffectNote): string {
  return `${note.title}: ${EFFECT_KEYS[note.key].applied(note.value, note.subject)}`
}

export function noteChip(note: EffectNote): string {
  return `${note.title} ${EFFECT_KEYS[note.key].chip(note.value)}`
}

function notesFor(fx: CombinedEffects, key: EffectKey, subject?: string | null): EffectNote[] {
  return (fx.get(key)?.sources ?? []).map((s) => ({ title: s.title, key, value: s.value, subject: subject ?? null }))
}

// ============================================================
// Formulas, identical to the SQL helpers
// ============================================================

export interface DecreeTarget {
  name: string
  fx: CombinedEffects
}

export interface DecreeCostInput {
  base: number
  wager: boolean
  actor: CombinedEffects
  aimsAtSalaxe: boolean
  actorIsSalaxe: boolean
  // Seats the decree is aimed at, the caster excluded.
  targets: readonly DecreeTarget[]
}

export interface Terms<T> {
  value: T
  notes: EffectNote[]
}

// The King's Wager is a stake, not a price: no title changes it.
export function decreeCost(input: DecreeCostInput): Terms<number> & { pct: number } {
  if (input.wager || input.base <= 0) return { value: input.base, pct: 0, notes: [] }
  const notes: EffectNote[] = notesFor(input.actor, "decree_cost_pct")
  let pct = fxValue(input.actor, "decree_cost_pct")
  if (input.aimsAtSalaxe && !input.actorIsSalaxe && fxHas(input.actor, "decree_cost_salaxe_pct")) {
    pct += fxValue(input.actor, "decree_cost_salaxe_pct")
    notes.push(...notesFor(input.actor, "decree_cost_salaxe_pct"))
  }
  const carpet = input.targets
    .filter((t) => fxHas(t.fx, "decree_cost_target_pct"))
    .sort((a, b) => fxValue(a.fx, "decree_cost_target_pct") - fxValue(b.fx, "decree_cost_target_pct"))[0]
  if (carpet) {
    pct += fxValue(carpet.fx, "decree_cost_target_pct")
    notes.push(...notesFor(carpet.fx, "decree_cost_target_pct", carpet.name))
  }
  pct = Math.min(DECREE_COST_RANGE.max, Math.max(DECREE_COST_RANGE.min, pct))
  return { value: scaled(input.base, pct), pct, notes: pct === 0 ? [] : notes }
}

export function decreeMaxUses(base: number, fx: CombinedEffects): number {
  return base > 0 ? base + fxValue(fx, "decree_extra_uses") : base
}

export function exileImmune(fx: CombinedEffects): boolean {
  return fxHas(fx, "exile_immune")
}

export function wagerBaseMultiplier(fx: CombinedEffects): number {
  return WAGER_BASE_MULTIPLIER + fxValue(fx, "wager_base_bonus")
}

export function earlySeconds(fx: CombinedEffects): number {
  return BET_RULES.earlySeconds + fxValue(fx, "early_window_bonus_s")
}

export function allInBonusPct(fx: CombinedEffects): number {
  return BET_RULES.allInBonusPct + fxValue(fx, "all_in_bonus_pct")
}

export function betCap(fx: CombinedEffects): number | null {
  return fx.get("bet_cap")?.value ?? null
}

export function insuranceBlocked(fx: CombinedEffects): boolean {
  return fxHas(fx, "insurance_blocked")
}

export function coveragePct(fx: CombinedEffects): number {
  return BET_RULES.coveragePct + fxValue(fx, "insurance_coverage_bonus")
}

// The King can neither worship nor slay himself: Salaxe never gets the discount on his own side.
export function premiumPct(basePct: number, fx: CombinedEffects, backsSalaxe: boolean, isSalaxe: boolean): number {
  const mod = backsSalaxe && !isSalaxe ? fxValue(fx, "insurance_premium_salaxe_pct") : 0
  return mod === 0 ? basePct : Math.ceil((basePct * (100 + mod)) / 100)
}

export function praiseReward(fx: CombinedEffects): number {
  return scaled(PRAISE_REWARD, fxValue(fx, "praise_bonus_pct"))
}

export function favorReward(fx: CombinedEffects): number {
  return scaled(ROYAL_FAVOR, fxValue(fx, "favor_bonus_pct"))
}

export interface StipendTerms {
  amount: number
  toSalaxe: boolean
  notes: EffectNote[]
}

export function stipendTerms(fx: CombinedEffects): StipendTerms {
  const amount = scaled(DAILY_STIPEND, fxValue(fx, "stipend_bonus_pct"))
  const toSalaxe = fxHas(fx, "stipend_to_salaxe")
  return {
    amount,
    toSalaxe,
    notes: [...notesFor(fx, "stipend_bonus_pct"), ...(toSalaxe ? notesFor(fx, "stipend_to_salaxe") : [])],
  }
}

export function bestowPrice(price: number, fx: CombinedEffects): number {
  return scaled(price, fxValue(fx, "bestow_cost_pct"))
}

export function duelTithe(stake: number, fx: CombinedEffects): number {
  return Math.floor((stake * DUEL_RULES.taxPct * (100 + fxValue(fx, "duel_tithe_pct"))) / 10000)
}

export function duelLossRefund(stake: number, fx: CombinedEffects): number {
  return Math.floor((stake * fxValue(fx, "duel_loss_refund_pct")) / 100)
}

export function isHerald(fx: CombinedEffects): boolean {
  return fxHas(fx, "herald")
}

export { notesFor as effectNotes }
