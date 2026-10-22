import { PERK_CAP, PERK_PENALTY_CAP, USER_PERK_CAP } from "@/lib/titles/rules"
import { isInvolved, type PerkGame, type PerkSubject } from "@/lib/titles/perk-kit"
import { perkFor } from "@/lib/titles/perks"
import type { PerkKind } from "@/lib/titles/types"

export interface PerkWearer {
  userId: string
  title: string
  category: string
  kind: PerkKind
  bestowedBy: string | null
}

export interface PerkApplication {
  userId: string
  title: string
  kind: PerkKind
  amount: number
  detail: string
  beneficiary: string | null
}

// Deterministic per game, wearer and title, so a retried settlement rolls the same dice.
export function perkRoll(sessionId: string, userId: string, title: string): number {
  let hash = 0x811c9dc5
  const input = `${sessionId}:${userId}:${title}`
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) / 0x100000000
}

export function emptySubject(userId: string, isSalaxe: boolean): PerkSubject {
  return { userId, isSalaxe, play: null, bet: null, chaosSpent: 0, bountyClaimed: 0 }
}

export function computePerkApplications(
  game: PerkGame,
  subjects: Map<string, PerkSubject>,
  wearers: PerkWearer[]
): PerkApplication[] {
  const applications: PerkApplication[] = []
  const paid = new Map<string, number>()
  for (const wearer of wearers) {
    const def = perkFor(wearer.title, wearer.category)
    if (!def || def.kind !== wearer.kind) continue
    if (wearer.kind === "curse" && (!wearer.bestowedBy || wearer.bestowedBy === wearer.userId)) continue

    const subject = subjects.get(wearer.userId)
    if (!subject || !isInvolved(subject)) continue

    const result = def.evaluate(subject, game, perkRoll(game.sessionId, wearer.userId, wearer.title))
    if (!result) continue

    const cap = Math.min(def.cap, PERK_CAP)
    let amount = Math.max(-cap, Math.min(cap, Math.round(result.amount)))
    if (wearer.kind === "curse") amount = -Math.abs(amount)
    else amount = Math.max(-PERK_PENALTY_CAP, amount)
    // A loadout's perks share USER_PERK_CAP per game (vvv_title_perk_room in SQL enforces the same).
    if (wearer.kind === "perk" && amount > 0) {
      const sofar = paid.get(wearer.userId) ?? 0
      amount = Math.min(amount, Math.max(0, USER_PERK_CAP - sofar))
      paid.set(wearer.userId, sofar + amount)
    }
    if (amount === 0) continue

    applications.push({
      userId: wearer.userId,
      title: wearer.title,
      kind: wearer.kind,
      amount,
      detail: result.detail,
      beneficiary: wearer.kind === "curse" ? wearer.bestowedBy : null,
    })
  }
  return applications
}
