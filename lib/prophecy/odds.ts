import { CATEGORIES, type Category } from "@/lib/prophecy/constants"
import type { MarketBook, MarketBooks, WagerStatus } from "@/lib/prophecy/types"

interface BookEntry {
  market: Category
  playerId: string | null
  stake: number
  status: WagerStatus
}

export function emptyBooks(): MarketBooks {
  return {
    mvp: { market: "mvp", pot: 0, prophets: 0, picks: {} },
    inter: { market: "inter", pot: 0, prophets: 0, picks: {} },
  }
}

// Refunded wagers left the pot; everything else (pending, won, lost) is part of it.
export function buildBooks(entries: BookEntry[]): MarketBooks {
  const books = emptyBooks()
  for (const entry of entries) {
    if (entry.status === "refunded" || !entry.playerId) continue
    const book = books[entry.market]
    book.pot += entry.stake
    book.prophets += 1
    const pick = book.picks[entry.playerId] ?? { stake: 0, prophets: 0 }
    book.picks[entry.playerId] = { stake: pick.stake + entry.stake, prophets: pick.prophets + 1 }
  }
  return books
}

export function addToBook(book: MarketBook, playerId: string, stake: number): MarketBook {
  const pick = book.picks[playerId] ?? { stake: 0, prophets: 0 }
  return {
    ...book,
    pot: book.pot + stake,
    prophets: book.prophets + 1,
    picks: { ...book.picks, [playerId]: { stake: pick.stake + stake, prophets: pick.prophets + 1 } },
  }
}

// Pari-mutuel: if this pick is voted, its backers share the whole pot pro rata.
export function currentMultiplier(book: MarketBook, playerId: string): number | null {
  const backed = book.picks[playerId]?.stake ?? 0
  if (backed <= 0) return null
  return book.pot / backed
}

// What a new stake on this pick would pay if the pick is voted and nobody else joins.
export function projectedMultiplier(book: MarketBook, playerId: string, stake: number): number {
  const backed = book.picks[playerId]?.stake ?? 0
  return (book.pot + stake) / (backed + stake)
}

export function projectedPayout(book: MarketBook, playerId: string, stake: number): number {
  return Math.floor(stake * projectedMultiplier(book, playerId, stake))
}

export function payoutIfHit(book: MarketBook, playerId: string, stake: number): number {
  const backed = book.picks[playerId]?.stake ?? 0
  if (backed <= 0) return stake
  return Math.floor((stake * book.pot) / backed)
}

export function formatMultiplier(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "x-"
  if (value >= 10) return `x${Math.round(value)}`
  return `x${value.toFixed(1)}`
}

export function favorites(book: MarketBook, limit = 3): { playerId: string; stake: number; prophets: number }[] {
  return Object.entries(book.picks)
    .map(([playerId, pick]) => ({ playerId, ...pick }))
    .sort((a, b) => b.stake - a.stake || b.prophets - a.prophets)
    .slice(0, limit)
}

export function totalPot(books: MarketBooks): number {
  return CATEGORIES.reduce((sum, c) => sum + books[c].pot, 0)
}
