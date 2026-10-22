import type { GazetteFacts } from "@/lib/lore/chronicle/facts"
import type { GazetteFact, GazetteKind } from "@/lib/lore/chronicle/types"
import { isSalaxe, mentionsSalaxe } from "@/lib/lore/salaxe"
import { pick } from "@/lib/lore/seed"
import { asName, asNum, loreLine, type LoreValue } from "@/lib/lore/segments"

const numbers = new Intl.NumberFormat("en-US")
const n = (value: number) => asNum(numbers.format(Math.round(value)))
const who = (name: string): LoreValue => (isSalaxe(name) ? { text: "Salaxe", mark: "salaxe" } : asName(name))
const names = (joined: string): LoreValue =>
  mentionsSalaxe(joined) ? { text: joined.replace(/\bsalaxe\b/gi, "Salaxe"), mark: "salaxe" } : asName(joined)

function fact(day: string, kind: GazetteKind, templates: readonly string[], values: Record<string, LoreValue>): GazetteFact {
  return { kind, ...loreLine(`${day}:${kind}`, pick(templates, `${day}:${kind}`), values) }
}

// Short data-driven lines for the gazette, the broadcasts from exile and the daily stipend.
export function writeGazette(facts: GazetteFacts): GazetteFact[] {
  const { day } = facts
  const out: GazetteFact[] = []

  if (facts.leader) {
    const values = { leader: who(facts.leader.name), balance: n(facts.leader.balance) }
    out.push(
      isSalaxe(facts.leader.name)
        ? fact(day, "leader", ["{leader} leads the treasury with {balance} points. The crown was never about money, he says, while counting it."], values)
        : fact(day, "leader", [
            "{leader} leads the treasury with {balance} points. The exile calls it a loan.",
            "Richest purse in the realm: {leader}, {balance} points. The notebook has opened a fresh page.",
            "{leader} sits on {balance} points. Salaxe has requested a small, temporary, unreturnable advance.",
          ], values)
    )
  }

  if (facts.salaxe) {
    const { wins, losses } = facts.salaxe
    const games = wins + losses
    if (games >= 3) {
      const rate = Math.round((wins / games) * 100)
      const values = { w: n(wins), l: n(losses), rate: asNum(`${rate}%`) }
      out.push(
        rate >= 55
          ? fact(day, "salaxe", [
              "Salaxe this Act: {w}-{l}, {rate} wins. The crown is wobbling back toward its owner.",
              "{w}-{l} this Act for Salaxe, {rate} wins. Rebels are advised to check their titles.",
            ], values)
          : rate < 45
            ? fact(day, "salaxe", [
                "Salaxe this Act: {w}-{l}, {rate} wins. Every loss officially logged as a delayed victory.",
                "{w}-{l} this Act for Salaxe, {rate} wins. He prefers the term rebuilding year.",
              ], values)
            : fact(day, "salaxe", [
                "Salaxe this Act: {w}-{l}, {rate} wins. Perfectly average. He disputes the word average.",
                "{w}-{l} this Act for Salaxe. A coin flip with a crown complex.",
              ], values)
      )
    }
  }

  if (facts.verdict && (facts.verdict.mvp || facts.verdict.inter)) {
    const { mvp, inter } = facts.verdict
    if (mvp && inter) {
      out.push(fact(day, "verdict", [
        "Latest Tribunal: {mvp} crowned, {inter} convicted. Appeals go to the notebook.",
        "The last court crowned {mvp} and condemned {inter}. Both are still talking about it.",
      ], { mvp: names(mvp), inter: names(inter) }))
    } else if (mvp) {
      out.push(fact(day, "verdict", ["Latest Tribunal: {mvp} crowned MVP. Nobody was convicted, somehow."], { mvp: names(mvp) }))
    } else if (inter) {
      out.push(fact(day, "verdict", ["Latest Tribunal: {inter} convicted as the Inter. No crown was handed out."], { inter: names(inter) }))
    }
  }

  if (facts.shamed && facts.shamed.count > 0) {
    const times = facts.shamed.count === 1 ? "once" : `${facts.shamed.count} times`
    out.push(fact(day, "shamed", [
      "{name} has been nailed to the Shame Board {times} this Act. A wing may be named after them.",
      "Most shamed this Act: {name}, {times}. The board thanks them for their service.",
    ], { name: who(facts.shamed.name), times: asNum(times) }))
  }

  if (facts.pauper && facts.pauper.balance < 0) {
    out.push(fact(day, "pauper", [
      "{pauper} is {debt} points in debt to the crown. The interest is emotional.",
      "{pauper} owes the treasury {debt} points. Repayment plan: vibes.",
    ], { pauper: who(facts.pauper.name), debt: n(Math.abs(facts.pauper.balance)) }))
  }

  return out
}
