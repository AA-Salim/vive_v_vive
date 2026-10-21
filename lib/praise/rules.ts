import { PRAISE_PROMPTS } from "@/lib/praise/prompts"

// Every rule below is mirrored in supabase/phase10_praise.sql (praise_rule_violation), which is the final authority.
export const PRAISE_REWARD = 150
export const ROYAL_FAVOR = 50
export const CROWNS_PER_DAY = 3
export const PRAISE_MIN_WORDS = 8
export const PRAISE_MIN_CHARS = 40
export const PRAISE_MAX_CHARS = 280
export const PRAISE_INPUT_MAX = 600
export const VERDICT_NOTE_MAX = 140

export const SALAXE_NAMES = ["Salaxe", "SLX", "Chklat", "Chalaksse", "Chklass", "Goblino", "Chalakssinoss", "Le Bon Salaxe"]

export type PraiseViolation =
  | "too_short"
  | "too_long"
  | "too_few_words"
  | "no_name"
  | "keyboard_mash"
  | "repetitive"
  | "too_many_symbols"
  | "prompt_copy"

export type PraiseCheck = "words" | "length" | "name" | "original" | "clean"
export type CheckState = "idle" | "progress" | "ok" | "fail"

export interface PraiseAnalysis {
  clean: string
  chars: number
  words: number
  violation: PraiseViolation | null
  checks: Record<PraiseCheck, CheckState>
  ready: boolean
}

const SPACE_RUN = /[ \t\f\v\r\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]+/g
const ALIAS = /(^| )(salax|slx|chalaks|chklat|chklass|goblino)/
const KEYBOARD_RUN =
  /(qwert|werty|ertyu|rtyui|tyuio|yuiop|asdfg|sdfgh|dfghj|fghjk|ghjkl|hjklm|zxcvb|xcvbn|cvbnm|azert|zerty|qsdfg|wxcvb|trewq|ytrew|uytre|iuytr|oiuyt|poiuy|gfdsa|hgfds|jhgfd|kjhgf|lkjhg|bvcxz|nbvcx|mnbvc)/
const CONSONANT_RUN = /[bcdfghjklmnpqrstvwxz]{6,}/
const LONG_WORD = /[a-z]{31,}/
const CHAR_RUN = /([\s\S])\1{5,}/u
const UNIT_RUN = /([\s\S]{2,3})\1{4,}/u
const WORD_RUN = /(^| )([a-z]+)( \2){3,}( |$)/

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

function countChars(clean: string): number {
  return Array.from(clean).length
}

function countWords(clean: string): number {
  return deaccent(clean)
    .split(/[ \n]+/)
    .filter((token) => /[a-z0-9]/.test(token)).length
}

function namesSalaxe(normalized: string): boolean {
  return ALIAS.test(normalized)
}

function isMash(clean: string, normalized: string): boolean {
  const lowered = deaccent(clean)
  return (
    CHAR_RUN.test(lowered) ||
    UNIT_RUN.test(lowered) ||
    KEYBOARD_RUN.test(normalized) ||
    CONSONANT_RUN.test(normalized) ||
    LONG_WORD.test(normalized)
  )
}

function isRepetitive(normalized: string): boolean {
  const words = normalized ? normalized.split(" ") : []
  const counts = new Map<string, number>()
  let singles = 0
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1)
    if (word.length === 1) singles++
  }
  const distinctLong = [...counts.keys()].filter((word) => word.length > 1).length
  const top = Math.max(0, ...counts.values())
  return (
    distinctLong < 5 ||
    singles * 10 > words.length * 3 ||
    (top > 3 && top * 100 > 34 * words.length) ||
    WORD_RUN.test(normalized)
  )
}

function hasTooManySymbols(clean: string): boolean {
  const compact = deaccent(clean).replace(/[ \n]/g, "")
  const letters = compact.replace(/[^a-z]/g, "").length
  return letters * 10 < Array.from(compact).length * 6
}

const PROMPT_KEYS = PRAISE_PROMPTS.map(normalizePraise)

function copiesPrompt(normalized: string): boolean {
  const padded = ` ${normalized} `
  return PROMPT_KEYS.some((key) => padded.includes(` ${key} `))
}

export function findViolation(clean: string): PraiseViolation | null {
  const chars = countChars(clean)
  if (chars < PRAISE_MIN_CHARS) return "too_short"
  if (chars > PRAISE_MAX_CHARS) return "too_long"
  if (countWords(clean) < PRAISE_MIN_WORDS) return "too_few_words"
  const normalized = normalizePraise(clean)
  if (!namesSalaxe(normalized)) return "no_name"
  if (isMash(clean, normalized)) return "keyboard_mash"
  if (isRepetitive(normalized)) return "repetitive"
  if (hasTooManySymbols(clean)) return "too_many_symbols"
  if (copiesPrompt(normalized)) return "prompt_copy"
  return null
}

export function analyzePraise(raw: string, knownFingerprints?: ReadonlySet<string>): PraiseAnalysis {
  const clean = cleanPraise(raw)
  const chars = countChars(clean)
  const words = countWords(clean)
  const normalized = normalizePraise(clean)
  const empty = chars === 0
  const enoughWords = words >= PRAISE_MIN_WORDS
  const knownCopy = !!knownFingerprints?.has(normalized)
  const violation = findViolation(clean)

  const cleanState: CheckState = empty
    ? "idle"
    : isMash(clean, normalized) || (enoughWords && (isRepetitive(normalized) || hasTooManySymbols(clean)))
      ? "fail"
      : enoughWords
        ? "ok"
        : "progress"

  const checks: Record<PraiseCheck, CheckState> = {
    words: empty ? "idle" : enoughWords ? "ok" : "progress",
    length: empty ? "idle" : chars > PRAISE_MAX_CHARS ? "fail" : chars >= PRAISE_MIN_CHARS ? "ok" : "progress",
    name: empty ? "idle" : namesSalaxe(normalized) ? "ok" : "progress",
    original: empty ? "idle" : copiesPrompt(normalized) || knownCopy ? "fail" : enoughWords ? "ok" : "progress",
    clean: cleanState,
  }

  return { clean, chars, words, violation, checks, ready: violation === null && !knownCopy }
}

export function praiseExcerpt(body: string, max = 90): string {
  const flat = body.replace(/\s+/g, " ").trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const lastSpace = cut.lastIndexOf(" ")
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${base.replace(/[\s,.;:!?-]+$/, "")}...`
}
