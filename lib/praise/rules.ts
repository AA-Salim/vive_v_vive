import { findInsult } from "@/lib/praise/insults"

// Every rule below is mirrored in supabase/phase10_praise.sql (praise_rules, praise_rule_violation), which is the
// final authority. praise_state() reports the live rules: until version 2 of that file runs, production still
// enforces the long written praise (LEGACY_PRAISE_RULES), so the client reads the rules from the state.
export interface PraiseRules {
  version: number
  reward: number
  minChars: number
  maxChars: number
  minWords: number
}

export const PRAISE_RULES: PraiseRules = { version: 2, reward: 300, minChars: 8, maxChars: 25, minWords: 2 }
export const LEGACY_PRAISE_RULES: PraiseRules = { version: 1, reward: 100, minChars: 40, maxChars: 280, minWords: 8 }

export const PRAISE_REWARD = PRAISE_RULES.reward
export const PRAISE_MIN_WORDS = PRAISE_RULES.minWords
export const PRAISE_MIN_CHARS = PRAISE_RULES.minChars
export const PRAISE_MAX_CHARS = PRAISE_RULES.maxChars
export const ROYAL_FAVOR = 50
export const CROWNS_PER_DAY = 3
export const COURT_WINDOW_DAYS = 7
export const PRAISE_INPUT_MAX = 600
export const VERDICT_NOTE_MAX = 140

// The King's Riddle, mirrored in supabase/phase10_riddles.sql (riddle_first_try_bonus, riddle_daily_limit).
export const RIDDLE_FIRST_TRY_BONUS = 20
export const RIDDLE_DAILY_LIMIT = 10

export const SALAXE_NAMES = ["Salaxe", "SLX", "Chklat", "Chalaksse", "Chklass", "Goblino", "Chalakssinoss", "Le Bon Salaxe"]

export type PraiseViolation =
  | "too_short"
  | "too_long"
  | "too_few_words"
  | "no_name"
  | "insult"
  | "keyboard_mash"
  | "repetitive"
  | "too_many_symbols"
  | "prompt_copy"

export type PraiseCheck = "length" | "words" | "name" | "respect" | "original" | "clean"
export type CheckState = "idle" | "progress" | "ok" | "fail"
export type PraiseIssue = PraiseViolation | "duplicate"

export interface PraiseAnalysis {
  clean: string
  chars: number
  words: number
  violation: PraiseViolation | null
  checks: Record<PraiseCheck, CheckState>
  issue: PraiseIssue | null
  ready: boolean
}

interface RulesFields {
  rules_version?: unknown
  reward?: unknown
  min_length?: unknown
  max_length?: unknown
  min_words?: unknown
}

const positive = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback

// The rules praise_state() reports. An older praise_state() reports none: that database runs the legacy rules.
export function praiseRulesFrom(row: RulesFields | null | undefined): PraiseRules {
  if (!row || typeof row.rules_version !== "number") return LEGACY_PRAISE_RULES
  const base = row.rules_version < 2 ? LEGACY_PRAISE_RULES : PRAISE_RULES
  return {
    version: row.rules_version,
    reward: positive(row.reward, base.reward),
    minChars: positive(row.min_length, base.minChars),
    maxChars: positive(row.max_length, base.maxChars),
    minWords: positive(row.min_words, base.minWords),
  }
}

const isLegacy = (rules: PraiseRules) => rules.version < 2

const SPACE_RUN = /[ \t\f\v\r\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/g
const ALIAS = /(^| )(salax|slx|chalaks|chklat|chklass|goblino)/
const KEYBOARD_RUN =
  /(qwert|werty|ertyu|rtyui|tyuio|yuiop|asdfg|sdfgh|dfghj|fghjk|ghjkl|hjklm|zxcvb|xcvbn|cvbnm|azert|zerty|qsdfg|wxcvb|trewq|ytrew|uytre|iuytr|oiuyt|poiuy|gfdsa|hgfds|jhgfd|kjhgf|lkjhg|bvcxz|nbvcx|mnbvc)/
const CONSONANT_RUN = /[bcdfghjklmnpqrstvwxz]{6,}/
const CHAR_RUN = /([\s\S])\1{5,}/
const LEGACY_LONG_WORD = /[a-z]{31,}/
const LEGACY_UNIT_RUN = /([\s\S]{2,3})\1{4,}/
const LONG_WORD = /[a-z]{20,}/
const UNIT_RUN = /([\s\S]{2,3})\1{3,}/
const WORD_RUN = /(^| )([a-z]+)( \2){3,}( |$)/
const STANDALONE_LETTERS = new Set(["a", "i", "o", "y"])

export function cleanPraise(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(SPACE_RUN, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^[ \n]+|[ \n]+$/g, "")
}

export function deaccent(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0153\u0152]/g, "oe")
    .replace(/[\u00e6\u00c6]/g, "ae")
    .replace(/\u00df/g, "ss")
    .toLowerCase()
}

export function normalizePraise(text: string): string {
  return deaccent(text)
    .replace(/['`\u2019\u02bc]/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim()
}

export function countChars(clean: string): number {
  return Array.from(clean).length
}

// A word has at least two letters or digits ("w", "x" or "#1" do not count); the legacy rules counted any token
// holding one.
function countWords(clean: string, rules: PraiseRules): number {
  const least = isLegacy(rules) ? 1 : 2
  return deaccent(clean)
    .split(/[ \n]+/)
    .filter((token) => token.replace(/[^a-z0-9]/g, "").length >= least).length
}

function namesSalaxe(normalized: string): boolean {
  return ALIAS.test(normalized)
}

// Runs are checked on letters only: "!!!!!!" or a row of hearts is enthusiasm, not mash. Short lines get tighter
// limits: four "ha" already fill a third of one, and no real word in 25 characters runs to 20 letters.
function isMash(normalized: string, rules: PraiseRules): boolean {
  const legacy = isLegacy(rules)
  return (
    CHAR_RUN.test(normalized) ||
    (legacy ? LEGACY_UNIT_RUN : UNIT_RUN).test(normalized) ||
    KEYBOARD_RUN.test(normalized) ||
    CONSONANT_RUN.test(normalized) ||
    (legacy ? LEGACY_LONG_WORD : LONG_WORD).test(normalized)
  )
}

// Legacy: function words (a, y, le, un, the...) repeat in any real sentence, so only stray letters and repeated
// words of 4+ letters count as filler. Short lines: no word of 4+ letters twice and no word three times, so
// "mon roi, mon GOAT" passes and "Legend Legend SLX" does not.
function isRepetitive(normalized: string, rules: PraiseRules): boolean {
  const words = normalized ? normalized.split(" ") : []
  const counts = new Map<string, number>()
  let singles = 0
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1)
    if (word.length === 1 && !STANDALONE_LETTERS.has(word)) singles++
  }
  const longCounts = [...counts].filter(([word]) => word.length > 3).map(([, count]) => count)
  const topLong = Math.max(0, ...longCounts)
  if (!isLegacy(rules)) return topLong > 1 || Math.max(0, ...counts.values()) > 2
  const distinctLong = [...counts.keys()].filter((word) => word.length > 1).length
  return (
    distinctLong < 5 ||
    singles * 10 > words.length * 3 ||
    (topLong > 3 && topLong * 100 > 34 * words.length) ||
    WORD_RUN.test(normalized)
  )
}

function hasTooManySymbols(clean: string): boolean {
  const compact = deaccent(clean).replace(/[ \n]/g, "")
  const letters = compact.replace(/[^a-z]/g, "").length
  return letters * 10 < Array.from(compact).length * 6
}

export function findViolation(clean: string, rules: PraiseRules = PRAISE_RULES): PraiseViolation | null {
  if (findInsult(clean)) return "insult"
  const chars = countChars(clean)
  if (chars < rules.minChars) return "too_short"
  if (chars > rules.maxChars) return "too_long"
  if (countWords(clean, rules) < rules.minWords) return "too_few_words"
  const normalized = normalizePraise(clean)
  if (!namesSalaxe(normalized)) return "no_name"
  if (isMash(normalized, rules)) return "keyboard_mash"
  if (isRepetitive(normalized, rules)) return "repetitive"
  if (hasTooManySymbols(clean)) return "too_many_symbols"
  return null
}

export function analyzePraise(
  raw: string,
  knownFingerprints?: ReadonlySet<string>,
  rules: PraiseRules = PRAISE_RULES
): PraiseAnalysis {
  const clean = cleanPraise(raw)
  const chars = countChars(clean)
  const words = countWords(clean, rules)
  const normalized = normalizePraise(clean)
  const empty = chars === 0
  const enoughWords = words >= rules.minWords
  const knownCopy = !!knownFingerprints?.has(normalized)
  const violation = findViolation(clean, rules)
  const insult = !!findInsult(clean)
  const mash = isMash(normalized, rules)
  const repetitive = enoughWords && isRepetitive(normalized, rules)
  const symbols = enoughWords && hasTooManySymbols(clean)
  const settled = enoughWords && chars >= rules.minChars

  const checks: Record<PraiseCheck, CheckState> = {
    length: empty ? "idle" : chars > rules.maxChars ? "fail" : chars >= rules.minChars ? "ok" : "progress",
    words: empty ? "idle" : enoughWords ? "ok" : "progress",
    name: empty ? "idle" : namesSalaxe(normalized) ? "ok" : "progress",
    respect: empty ? "idle" : insult ? "fail" : settled ? "ok" : "progress",
    original: empty ? "idle" : knownCopy ? "fail" : settled ? "ok" : "progress",
    clean: empty ? "idle" : mash || repetitive || symbols ? "fail" : settled ? "ok" : "progress",
  }

  const issue: PraiseIssue | null = insult
    ? "insult"
    : checks.length === "fail"
      ? "too_long"
      : checks.clean === "fail"
        ? mash
          ? "keyboard_mash"
          : repetitive
            ? "repetitive"
            : "too_many_symbols"
        : knownCopy
          ? "duplicate"
          : null

  return { clean, chars, words, violation, checks, issue, ready: violation === null && !knownCopy }
}

export function praiseExcerpt(body: string, max = 90): string {
  const flat = body.replace(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const lastSpace = cut.lastIndexOf(" ")
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${base.replace(/[\s,.;:!?-]+$/, "")}...`
}
