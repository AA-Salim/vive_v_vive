import { NextResponse } from "next/server"
import { BOUNTY_RULES, PILLORY_RULES } from "@/lib/bounties/rules"

const RPC_ERRORS: [string, number, string, string][] = [
  ["bounty:not_authenticated", 401, "auth_required", "Sign in with Discord to sign a royal warrant."],
  ["bounty:amount_too_small", 400, "amount_too_small", `Warrants start at ${BOUNTY_RULES.minPledge} points. The Crown does not print posters for pocket change.`],
  ["bounty:amount_too_large", 400, "amount_too_large", `One backer can put at most ${BOUNTY_RULES.maxBackerTotal} points on a head.`],
  ["bounty:backer_cap", 400, "backer_cap", `You already put close to ${BOUNTY_RULES.maxBackerTotal} on this head. Let someone else hate them too.`],
  ["bounty:target_not_found", 404, "target_not_found", "That player is not on the roster anymore."],
  ["bounty:target_inactive", 400, "target_inactive", "That player retired from the Rift. Nobody to hunt."],
  ["bounty:self", 400, "self", "A warrant on your own head? The court admires the honesty, but no."],
  ["bounty:no_balance", 400, "no_balance", "Claim your points first: your treasury is empty."],
  ["bounty:debt_limit", 400, "debt_limit", `Debt limit reached (${BOUNTY_RULES.debtFloor}). Even Salaxe's notebook has a last page.`],
  ["pillory:not_authenticated", 401, "auth_required", "Sign in with Discord to use the pillory."],
  ["pillory:message_required", 400, "message_required", "Pick a roast or write one. Silence is not shame."],
  ["pillory:message_too_long", 400, "message_too_long", `Keep it under ${PILLORY_RULES.messageMax} characters. Shame works best short.`],
  ["pillory:target_not_found", 404, "target_not_found", "That player is not on the roster anymore."],
  ["pillory:self", 400, "self", "You cannot pillory yourself. Therapy is down the hall."],
  ["pillory:no_balance", 400, "no_balance", "Claim your points first: your treasury is empty."],
  ["pillory:cooldown", 429, "cooldown", `One pillory every ${PILLORY_RULES.cooldownHours} hours. Let the last one ripen.`],
  ["pillory:already_pilloried", 409, "already_pilloried", "Already on the wall. Throw an egg instead."],
  ["pillory:debt_limit", 400, "debt_limit", `Debt limit reached (${PILLORY_RULES.debtFloor}). Even Salaxe's notebook has a last page.`],
  ["pillory:entry_gone", 410, "entry_gone", "Too late, they were let down from the pillory."],
  ["pillory:own_egg", 400, "own_egg", "Pelting yourself is not penance, it is a cry for help."],
  ["pillory:already_thrown", 409, "already_thrown", "You already threw your egg. One per sinner."],
  ["Debt limit", 400, "debt_limit", "Debt limit reached (-300 max)."],
  ["User balance not found", 400, "no_balance", "Claim your points first: your treasury is empty."],
]

export function rpcError(error: { message?: string } | null | undefined, fallback: string) {
  const message = error?.message ?? ""
  const match = RPC_ERRORS.find(([key]) => message.includes(key))
  if (match) return NextResponse.json({ error: match[3], code: match[2] }, { status: match[1] })
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export function badRequest(message: string, code = "invalid_input") {
  return NextResponse.json({ error: message, code }, { status: 400 })
}

export function unauthorized(message: string) {
  return NextResponse.json({ error: message, code: "auth_required" }, { status: 401 })
}
