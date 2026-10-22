import { FREE, type HelpEntry } from "@/lib/help"
import { CHAMPION_PICK_SECONDS } from "@/lib/lobby/champion-pick"

export const CHAMPION_HELP = {
  phase: {
    title: "Champion select",
    does: "The teams and lanes are locked. Now the coaches pick the champion for every player on their team, one pick at a time. No dice.",
    cost: FREE,
    limits: "When all ten are picked, the game moves on to the draft with those champions. They stay locked: re-rolls skip them, decrees can still change them.",
  },
  order: {
    title: "Pick order",
    does: "Real draft order: Blue 1, Red 2, Blue 2, Red 2, Blue 2, Red 1. On each pick, the coach chooses which of their players gets a champion, then which champion.",
    cost: FREE,
  },
  timer: {
    title: "Pick timer",
    does: `Each pick has ${CHAMPION_PICK_SECONDS} seconds on the server clock. If it runs out, the server locks a champion for the first open lane of that team: the player's request if it is still free, otherwise a random champion from their lane pool.`,
    cost: FREE,
    limits: "Auto-picks are final.",
  },
  pool: {
    title: "Available champions",
    does: "Any champion can be picked. The selected player's lane pool is listed first; filter by lane or search by name.",
    cost: FREE,
    limits: "Greyed out: today's fearless bans (already played today) and champions already picked in this game.",
  },
  requests: {
    title: "Champion requests",
    does: "Pin the champion you want so your coach sees it on your slot. Only your own team sees requests.",
    cost: FREE,
    limits: "One per player. Change or clear it any time until your champion is locked.",
  },
  undo: {
    title: "Take back a pick",
    does: "Misclick? The coach who made the latest pick can take it back until the next pick lands, and gets a fresh clock.",
    cost: FREE,
    limits: "Auto-picks cannot be taken back.",
  },
} satisfies Record<string, HelpEntry>
