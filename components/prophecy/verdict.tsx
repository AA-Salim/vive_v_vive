"use client"

import { useEffect } from "react"
import Image from "next/image"
import { motion, useReducedMotion } from "motion/react"
import confetti from "canvas-confetti"
import { CoinsIcon, ScaleIcon } from "lucide-react"
import { ChampionPortrait } from "@/components/prophecy/champion-portrait"
import { TONES } from "@/components/prophecy/category-meta"
import { describeMarket } from "@/components/prophecy/market-outcome"
import type { ClockedTribunal } from "@/components/prophecy/queries"
import { CATEGORIES, type Category } from "@/lib/prophecy/constants"
import { CATEGORY_COPY, verdictLine } from "@/lib/prophecy/lines"
import type { Candidate, VerdictSummary } from "@/lib/prophecy/types"
import { cn } from "@/lib/utils"

const SPLASH = (internal: string) => `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${internal}_0.jpg`

function cssColor(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value || fallback
}

function useCelebration(sessionId: string, celebrate: boolean) {
  const reduceMotion = useReducedMotion()
  useEffect(() => {
    if (!celebrate || reduceMotion) return
    const key = `vvv-verdict-confetti-${sessionId}`
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, "1")
    const colors = [cssColor("--color-gold", "gold"), cssColor("--color-gold-light", "white"), cssColor("--color-blue-team", "blue")]
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.7 }, colors, disableForReducedMotion: true })
  }, [celebrate, reduceMotion, sessionId])
}

export function Verdict({ state, summary }: { state: ClockedTribunal; summary: VerdictSummary }) {
  const byId = new Map(state.candidates.map((c) => [c.playerId, c]))
  const winnerSide = state.vote?.winnerSide ?? null
  const myWager = state.myWager
  const selfId = state.viewer?.playerId ?? null
  const crownedSelf = !!selfId && summary.mvp.winners.includes(selfId)
  useCelebration(state.sessionId, myWager?.status === "won" || crownedSelf)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {CATEGORIES.map((category, index) => (
          <VerdictCard
            key={category}
            category={category}
            index={index}
            summary={summary}
            winners={summary[category].winners.map((id) => byId.get(id)).filter((c): c is Candidate => !!c)}
            winnerSide={winnerSide}
            seed={state.sessionId}
          />
        ))}
      </div>
      <PersonalVerdict state={state} summary={summary} />
    </div>
  )
}

interface VerdictCardProps {
  category: Category
  index: number
  summary: VerdictSummary
  winners: Candidate[]
  winnerSide: string | null
  seed: string
}

function VerdictCard({ category, index, summary, winners, winnerSide, seed }: VerdictCardProps) {
  const tone = TONES[category]
  const Icon = tone.icon
  const market = summary[category]
  const lead = winners[0]
  const line = verdictLine({
    category,
    outcome: market.outcome,
    names: winners.map((w) => w.name),
    champions: winners.map((w) => w.champion),
    onWinningSide: winners.map((w) => w.side === winnerSide),
    seed,
  })
  const bonusPaid = category === "mvp" && winners.some((w) => summary.mvp_bonus_paid.includes(w.playerId))

  return (
    <motion.article
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.15 + index * 0.25, type: "spring", stiffness: 160, damping: 20 }}
      className={cn("relative isolate overflow-hidden rounded-2xl border bg-[var(--color-navy)]", tone.border)}
    >
      {lead && (
        <Image
          src={SPLASH(lead.championInternal)}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 768px) 50vw, 100vw"
          className={cn("-z-20 object-cover object-[50%_20%] opacity-40", category === "inter" && "grayscale")}
        />
      )}
      <div
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10 bg-gradient-to-t from-[var(--color-navy)] via-[var(--color-navy)]/85 to-[var(--color-navy)]/30",
          category === "inter" && "via-[var(--color-navy)]/90"
        )}
      />
      <div className="p-4">
        <motion.div
          initial={{ opacity: 0, y: -10, rotate: -8 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ delay: 0.35 + index * 0.25, type: "spring", stiffness: 220, damping: 14 }}
          className={cn("flex items-center gap-1.5 text-[11px] font-bold tracking-[0.22em] uppercase", tone.text)}
        >
          <Icon className="size-4" aria-hidden />
          {CATEGORY_COPY[category].crowned}
        </motion.div>

        {winners.length > 0 ? (
          <div className="mt-3 space-y-2">
            {winners.map((w) => (
              <div key={w.playerId} className="flex items-center gap-3">
                <ChampionPortrait championInternal={w.championInternal} champion={w.champion} side={w.side} size="lg" />
                <div className="min-w-0">
                  <div className="truncate font-display text-2xl leading-tight font-semibold text-foreground">{w.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {w.champion} · {market.tallies[w.playerId] ?? 0} of {market.ballots} votes
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2 font-display text-xl font-semibold text-foreground">
            <ScaleIcon className="size-5 text-muted-foreground" aria-hidden />
            No verdict
          </div>
        )}

        <p className={cn("mt-3 border-l-2 pl-3 text-sm leading-relaxed text-foreground/90 italic", tone.border)}>{line}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {bonusPaid && (
            <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold", tone.chip)}>
              <CoinsIcon className="size-3" aria-hidden />+{summary.mvp_bonus} royal bonus
            </span>
          )}
          <span>{describeMarket(market)}</span>
        </div>
      </div>
    </motion.article>
  )
}

function PersonalVerdict({ state, summary }: { state: ClockedTribunal; summary: VerdictSummary }) {
  const wager = state.myWager
  const lines: { text: string; tone: string }[] = []

  if (wager?.status === "won") lines.push({ text: `Your prophecy hit: +${wager.payout ?? 0} points. The Oracle smiles.`, tone: "text-emerald-300" })
  if (wager?.status === "lost") lines.push({ text: `Your prophecy crumbled. ${wager.stake} points to the prophets who saw it coming.`, tone: "text-destructive" })
  if (wager?.status === "refunded") lines.push({ text: `Your ${wager.stake} point stake came back. The Oracle shrugs.`, tone: "text-muted-foreground" })

  for (const category of CATEGORIES) {
    const pick = state.mine[category]
    const market = summary[category]
    if (!pick || market.outcome !== "decided") continue
    const agreed = market.winners.includes(pick)
    lines.push({
      text: agreed
        ? `You voted with the court on the ${CATEGORY_COPY[category].crowned}.`
        : `The court outvoted you on the ${CATEGORY_COPY[category].crowned}.`,
      tone: "text-muted-foreground",
    })
  }

  if (lines.length === 0) return null
  return (
    <motion.ul
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.8 }}
      className="space-y-1 rounded-xl border border-border bg-[var(--color-navy)]/60 px-3 py-2.5 text-xs"
    >
      {lines.map((line) => (
        <li key={line.text} className={line.tone}>
          {line.text}
        </li>
      ))}
    </motion.ul>
  )
}
