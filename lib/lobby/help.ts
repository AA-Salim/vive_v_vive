import { FREE, type HelpEntry } from "@/lib/help"
import { ROLE_LABELS } from "@/lib/champions"
import { LANES, LOBBY_SIZE, PLAYER_NAME_MAX, QUEUE_TTL_MS, SERPENTINE, TEAM_SIZE } from "@/lib/lobby/constants"

const QUEUE_HOURS = Math.round(QUEUE_TTL_MS / 3_600_000)
export const SNAKE_ORDER = SERPENTINE.map((side) => (side === "blue" ? "Blue" : "Red")).join(", ")
const LANE_LIST = LANES.map((lane) => ROLE_LABELS[lane]).join(", ")

export const QUEUE_HELP = {
  queue: {
    title: "The Queue",
    does: "The line for the next game. The roster seats it in one tap, and winner stays calls it up in order.",
    cost: FREE,
    limits: `One spot per player, kept for ${QUEUE_HOURS} hours. Being dealt into a game takes you out of the line. Admins can reorder, remove or clear it.`,
  },
  join: {
    title: "Join or leave the queue",
    does: "Takes a spot at the back of the line, or gives yours up. Leaving is instant.",
    cost: FREE,
    limits: `You need a claimed player. Your spot lasts ${QUEUE_HOURS} hours.`,
  },
  clear: {
    title: "Clear the queue",
    does: "Empties the line. Nobody loses anything but their place.",
    cost: FREE,
    limits: "Admins only. Everyone can queue again with one tap.",
  },
} satisfies Record<string, HelpEntry>

export function rosterHelp(maxSelection: number) {
  return {
    roster: {
      title: "The Roster",
      does: `Pick the ${LOBBY_SIZE} who play next, then roll random teams or summon two coaches to draft them.`,
      cost: FREE,
      limits: `Exactly ${LOBBY_SIZE} to roll. Select up to ${maxSelection} to give the coaches a bigger pool. Benched players stay hidden.`,
    },
    quickSeats: {
      title: "Quick seats",
      does: `Seat the queue puts the first ${LOBBY_SIZE} in line in the seats and keeps your other picks after them. Same ten replays last game's lineup.`,
      cost: FREE,
      limits: "Only changes your selection. Nothing is dealt until you roll.",
    },
    roll: {
      title: "Roll the teams",
      does: "Deals the ten into two random teams with random lanes and champions, fearless bans included.",
      cost: FREE,
      limits: `Exactly ${LOBBY_SIZE} players, one game at a time. Anyone signed in can roll. Seated players leave the queue.`,
    },
    coachDraft: {
      title: "Coach draft",
      does: "Two coaches pick the teams in turn and set their lanes. Champions stay random.",
      cost: FREE,
      limits: `The pool is your picks when ${LOBBY_SIZE} or more are selected, otherwise every active player. Coaches must have signed in once.`,
    },
    admin: {
      title: "Roster admin",
      does: "Add, rename, bench or delete players. Bench hides a player from picks and the queue; history and titles stay.",
      cost: FREE,
      limits: `Admins only. Names up to ${PLAYER_NAME_MAX} characters, unique. Only unclaimed players who never played can be deleted: the rest are benched.`,
    },
  } satisfies Record<string, HelpEntry>
}

export const DELETE_HELP: HelpEntry = {
  title: "Delete a player",
  does: "Strikes the name from the roster for good.",
  cost: FREE,
  limits: "Admins only, and only for unclaimed players with no trace in the archives (games, drafts, warrants, pillories, votes). Everyone else can only be benched.",
}

export const ROTATION_HELP = {
  board: {
    title: "Winner Stays",
    does: "After each game the winners keep their seats and the first in the queue take the losers' places.",
    cost: FREE,
    limits: "Losers only stay when the queue runs short: volunteers first, then by lot. Winners who gave up their seat are called back last.",
  },
  start: {
    title: "Start winner stays",
    does: "Turns the rotation on. A game that just ended seeds the first throne.",
    cost: FREE,
    limits: "Admins only. Turning it off forgets winners, losers and volunteers; the queue stays.",
  },
  sitOut: {
    title: "Give up your seat",
    does: "Hands your winner's seat to the queue and puts you in line.",
    cost: FREE,
    limits: "Only last game's winners. Take it back any time before the rotation. If the line runs short, you are called back last.",
  },
  takeBack: {
    title: "Take your seat back",
    does: "Reclaims the winner's seat you gave up and takes you out of the line.",
    cost: FREE,
    limits: "Only before the next rotation.",
  },
  volunteer: {
    title: "Volunteer to stay",
    does: "Losers keep a seat only when the queue cannot fill them all. Volunteers get those seats first; the rest are drawn by lot.",
    cost: FREE,
    limits: "Only last game's losers. Withdraw any time before the rotation. Losers who rotate out go to the back of the queue.",
  },
  mode: {
    title: "How teams form",
    does: "Champions together: the winners defend as one team against the newcomers. Mix all ten: everyone is shuffled.",
    cost: FREE,
  },
  rotate: {
    title: "Rotate and deal",
    does: "Seats the next ten, forms the teams and deals random lanes and champions. Losers who rotate out join the back of the queue.",
    cost: FREE,
    limits: `Only the last game's host or an admin, with ${LOBBY_SIZE} players ready.`,
  },
  off: {
    title: "Turn winner stays off",
    does: "Stops the rotation and forgets who won, lost or volunteered.",
    cost: FREE,
    limits: "Admins only. The queue stays as it is.",
  },
} satisfies Record<string, HelpEntry>

export const COACH_HELP = {
  board: {
    title: "The Draft Board",
    does: `Two coaches pick the ${LOBBY_SIZE} players in turn, then each sets lanes for their own ${TEAM_SIZE}.`,
    cost: FREE,
    limits: `Snake order: ${SNAKE_ORDER}. Champions are dealt at random once the teams lock.`,
  },
  summon: {
    title: "Summon two coaches",
    does: "Names the two captains who draft the teams. A coach does not have to play.",
    cost: FREE,
    limits: `Two different people who signed in here once. The pool needs ${LOBBY_SIZE} active players or more.`,
  },
  pick: {
    title: "Lock in a pick",
    does: "Puts the chosen player on your team. Then the other coach is on the clock.",
    cost: FREE,
    limits: `Only the coach on the clock. Snake order: ${SNAKE_ORDER}.`,
  },
  undo: {
    title: "Take back a pick",
    does: "Returns your latest pick to the pool and gives you the turn again.",
    cost: FREE,
    limits: "Only the coach who made the latest pick, and only until the next pick lands.",
  },
  lanes: {
    title: "Set the lanes",
    does: "Gives each of your players a lane. Tapping a lane a teammate holds swaps the two; the dice fill the rest at random.",
    cost: FREE,
    limits: `One of each per team: ${LANE_LIST}. Each coach sets their own team; an admin can set either.`,
  },
  lock: {
    title: "Lock the teams",
    does: "Locks both teams and deals champions at random, fearless bans included. Drafted players leave the queue.",
    cost: FREE,
    limits: `Either coach or an admin, once all ${LOBBY_SIZE} have a lane.`,
  },
  lockPick: {
    title: "Lock the teams",
    does: "Locks both teams and opens champion select: the coaches pick every champion for their own players in draft order, fearless bans included. Drafted players leave the queue.",
    cost: FREE,
    limits: `Either coach or an admin, once all ${LOBBY_SIZE} have a lane. Each pick has a timer; a coach who stalls gets a random champion from that lane.`,
  },
} satisfies Record<string, HelpEntry>
