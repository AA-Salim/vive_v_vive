import { BOUNTY_RULES, PILLORY_RULES } from "@/lib/bounties/rules"

export const WARRANT_COPY = {
  title: "Royal Warrants",
  tagline: "Price a head. Beat them, split the pot.",
  sheetDescription: "Put a price on a player. The next team that beats them splits it.",
  empty: "No warrants. The Rift is suspiciously peaceful.",
  emptyCta: "Post the first warrant",
  post: "Post a warrant",
  seeAll: "All warrants",
  addTo: "Add to the bounty",
  pending: "The royal scribes are still inking the warrant forms. Posting opens with the next decree.",
  error: "The warrant board fell off the wall. Your points are safe.",
  loginHint: "Sign in to sign a warrant.",
  legacy: "Old-style bounty: pays its poster 1.5x if the target loses.",
}

export const WARRANT_RULES = [
  `From ${BOUNTY_RULES.minPledge} points. Pledges stack on one warrant per head, up to ${BOUNTY_RULES.maxBackerTotal} per backer.`,
  "The wanted player loses: the linked players of the team that beat them split the whole price.",
  `The wanted player wins: an escape. The warrant stays up and the Crown adds ${BOUNTY_RULES.escapePct}% (${BOUNTY_RULES.escapeMin} to ${BOUNTY_RULES.escapeMax} per escape).`,
  `Unclaimed ${BOUNTY_RULES.lifetimeDays} days after the last pledge: every backer gets their points back.`,
]

const POSTER_LINES = [
  "Dead or alive. Preferably 0/10.",
  "Last seen face-checking a bush.",
  "Approach with caution. Or with a ward.",
  "Bring me their head, or at least their nexus.",
  "Reward paid in points, not in honor.",
  "Known associates: bad decisions.",
]

const ESCAPE_LINES = [
  "Slipped the noose",
  "Escaped the hunt",
  "Still at large",
]

function pickBy(items: string[], key: string) {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return items[Math.abs(h) % items.length]
}

export const posterLine = (warrantId: string) => pickBy(POSTER_LINES, warrantId)
export const escapeLine = (warrantId: string) => pickBy(ESCAPE_LINES, warrantId)

export const PILLORY_COPY = {
  title: "The Pillory",
  tagline: `${PILLORY_RULES.cost} points, ${PILLORY_RULES.hours} hours on the wall.`,
  sheetDescription: "Name, shame, and pelt. The Tribunal's Inter goes up for free.",
  empty: "The pillory stands empty. Somebody int, please.",
  post: "Pillory someone",
  seeAll: "The wall",
  pending: "The carpenters are still building the new pillory. Shaming resumes shortly.",
  error: "The pillory collapsed under the weight of the shame. Try again.",
  loginHint: "Sign in to pillory someone.",
  tribunal: "By decree of the Tribunal",
  you: "You are on the wall. Salaxe is taking notes.",
  egg: "Throw an egg",
  eggDone: "Splat",
}

export const PILLORY_RULES_COPY = [
  `${PILLORY_RULES.cost} points puts a player on the wall for ${PILLORY_RULES.hours} hours with their worst real stat.`,
  `One live entry per player, one pillory per shamer every ${PILLORY_RULES.cooldownHours} hours.`,
  `Eggs are free: each one keeps them up ${PILLORY_RULES.eggHours} more hour (${PILLORY_RULES.eggMaxHours} at most).`,
  "The player the Tribunal votes Inter goes up for free.",
]
