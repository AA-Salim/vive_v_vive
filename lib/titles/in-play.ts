import { MIN_STAKE } from "@/lib/titles/rules"
import type { PerkDefinition, PerkGame, PerkSubject } from "@/lib/titles/perk-kit"
import type { PerkKind } from "@/lib/titles/types"
import type { Side } from "@/lib/types"

export type PlayContext = "bet" | "decree" | "duel"

// direct: this action changes what the title pays. ifPlaying: it does, but only for someone also playing.
// joins: it only makes you part of the game, which is enough for the title to fire. play: it pays on the
// Rift, whatever you do here. none: out of reach.
export type Reach = "direct" | "ifPlaying" | "joins" | "play" | "none"

const SIDES: Side[] = ["blue", "red"]
const ROLLS = [0.2, 0.8]
const STAKE = Math.max(100, MIN_STAKE)

function games(): PerkGame[] {
  return SIDES.map((winnerSide) => ({
    sessionId: "preview",
    winnerSide,
    salaxeSide: "blue",
    pool: 10 * STAKE,
    backers: { blue: 3, red: 2 },
  }))
}

function subject(patch: Partial<PerkSubject>): PerkSubject {
  return { userId: "preview", isSalaxe: false, play: null, bet: null, chaosSpent: 0, bountyClaimed: 0, ...patch }
}

const betOn = (side: Side, game: PerkGame) => {
  const won = side === game.winnerSide
  return { side, stake: STAKE, payout: won ? Math.round(STAKE * 1.8) : 0, won }
}

const playOn = (side: Side, game: PerkGame) => ({ side, lane: "mid" as const, won: side === game.winnerSide })

function outcome(def: PerkDefinition, s: PerkSubject, g: PerkGame, roll: number): number | null {
  return def.evaluate(s, g, roll)?.amount ?? null
}

// Replays the real perk rules on a handful of games to tell whether an action feeds a title.
// Nothing here is retyped: change a perk in lib/titles/perks.ts and the hints follow.
export function reachOf(def: PerkDefinition, context: PlayContext): Reach {
  const cases = games().flatMap((g) => ROLLS.map((roll) => ({ g, roll })))
  const bare = (g: PerkGame, roll: number) => outcome(def, subject({ bountyClaimed: 1 }), g, roll)
  const paysOnPlay = cases.some(({ g, roll }) => SIDES.some((side) => outcome(def, subject({ play: playOn(side, g) }), g, roll) !== null))

  if (context === "bet") {
    const direct = cases.some(({ g, roll }) =>
      SIDES.some((side) => {
        const withBet = outcome(def, subject({ bet: betOn(side, g) }), g, roll)
        return withBet !== null && withBet !== bare(g, roll)
      })
    )
    if (direct) return "direct"
    const whilePlaying = cases.some(({ g, roll }) =>
      SIDES.some((side) => {
        const play = playOn(side, g)
        return outcome(def, subject({ play, bet: betOn(side, g) }), g, roll) !== outcome(def, subject({ play }), g, roll)
      })
    )
    if (whilePlaying) return "ifPlaying"
    if (cases.some(({ g, roll }) => bare(g, roll) !== null)) return "joins"
    return paysOnPlay ? "play" : "none"
  }

  if (context === "decree") {
    const scales = cases.some(({ g, roll }) => {
      const small = outcome(def, subject({ chaosSpent: STAKE }), g, roll)
      return small !== null && small !== outcome(def, subject({ chaosSpent: STAKE * 2 }), g, roll)
    })
    if (scales) return "direct"
    if (cases.some(({ g, roll }) => outcome(def, subject({ chaosSpent: STAKE }), g, roll) !== null)) return "joins"
    return paysOnPlay ? "play" : "none"
  }

  return paysOnPlay ? "play" : cases.some(({ g, roll }) => bare(g, roll) !== null) ? "joins" : "none"
}

const VERB: Record<PlayContext, string> = { bet: "bet", decree: "decree", duel: "duel" }

export function reachNote(reach: Reach, context: PlayContext, kind: PerkKind): string | null {
  const curse = kind === "curse"
  if (context === "duel") {
    if (reach === "none") return null
    return curse
      ? "Duel stakes are out of the brand's reach, but it still bites on the game itself."
      : "Duel stakes are out of a title's reach, but it still pays on the game itself."
  }
  switch (reach) {
    case "direct":
      return curse ? `This ${VERB[context]} feeds the brand.` : `Rides on this ${VERB[context]}.`
    case "ifPlaying":
      return curse ? "This bet feeds the brand if you are also playing." : "Rides on this bet if you are also playing this game."
    case "joins":
      return context === "bet"
        ? curse
          ? `A bet of ${MIN_STAKE}+ puts you in the game, and the brand bites after it.`
          : `A bet of ${MIN_STAKE}+ puts you in the game: it pays after.`
        : curse
          ? "A decree puts you in the game, and the brand bites after it."
          : "A decree puts you in the game: it pays after."
    case "play":
      return context === "bet"
        ? curse
          ? "Bites on the Rift, not on the bet slip."
          : "Pays when you play this game, whatever you bet."
        : null
    default:
      return null
  }
}
