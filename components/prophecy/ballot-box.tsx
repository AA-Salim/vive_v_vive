"use client"

import { useState } from "react"
import { LogInIcon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AnimatedNumber } from "@/components/prophecy/animated-number"
import { CandidateGrid } from "@/components/prophecy/candidate-grid"
import { TONES } from "@/components/prophecy/category-meta"
import { BALLOT_HELP } from "@/components/prophecy/help"
import { useCastVote, type ClockedTribunal } from "@/components/prophecy/queries"
import { CATEGORIES, type Category } from "@/lib/prophecy/constants"
import { CATEGORY_COPY } from "@/lib/prophecy/lines"
import type { Candidate, VoterView } from "@/lib/prophecy/types"
import { cn } from "@/lib/utils"

interface BallotBoxProps {
  state: ClockedTribunal
  onSignIn: () => void
}

export function BallotBox({ state, onSignIn }: BallotBoxProps) {
  const cast = useCastVote(state.sessionId)
  const [category, setCategory] = useState<Category>(() => (state.mine.mvp && !state.mine.inter ? "inter" : "mvp"))
  const names = new Map(state.candidates.map((c) => [c.playerId, c.name]))
  const selfId = state.viewer?.playerId ?? null

  const vote = (target: Category, playerId: string) => {
    if (state.mine[target] === playerId) return
    const other: Category = target === "mvp" ? "inter" : "mvp"
    cast.mutate(
      { category: target, playerId },
      {
        onSuccess: () => {
          if (!state.mine[other]) setCategory(other)
        },
      }
    )
  }

  return (
    <Tabs value={category} onValueChange={(value) => setCategory(value as Category)} className="gap-3">
      <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-[var(--color-navy)]/70 p-1 group-data-horizontal/tabs:h-auto">
        {CATEGORIES.map((c) => {
          const tone = TONES[c]
          const Icon = tone.icon
          const pick = state.mine[c]
          return (
            <TabsTrigger
              key={c}
              value={c}
              className={cn(
                "h-auto min-h-12 flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left whitespace-normal",
                "data-active:bg-[var(--color-navy-lighter)] data-active:ring-1",
                c === "mvp" ? "data-active:ring-[var(--color-gold)]/50" : "data-active:ring-violet-400/50"
              )}
            >
              <span className={cn("flex items-center gap-1.5 text-xs font-bold tracking-wide uppercase", tone.text)}>
                <Icon className="size-4" aria-hidden />
                <span className="sm:hidden">{CATEGORY_COPY[c].short}</span>
                <span className="hidden sm:inline">{CATEGORY_COPY[c].voteTitle}</span>
              </span>
              <span className="truncate text-[11px] font-normal text-muted-foreground">
                {pick ? `Your vote: ${names.get(pick) ?? "?"}` : state.viewer ? "Not voted yet" : `${state.ballots[c]} ballots`}
              </span>
            </TabsTrigger>
          )
        })}
      </TabsList>

      {CATEGORIES.map((c) => (
        <TabsContent key={c} value={c} className="space-y-3">
          <CategoryBallot
            state={state}
            category={c}
            selfId={selfId}
            onVote={state.viewer ? (playerId) => vote(c, playerId) : undefined}
          />
        </TabsContent>
      ))}

      {!state.viewer && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-center">
          <p className="text-sm text-muted-foreground">Log in with Discord to cast your ballot.</p>
          <Button onClick={onSignIn} variant="outline" className="h-10 gap-1.5 px-4">
            <LogInIcon className="size-4" aria-hidden />
            Log in to vote
          </Button>
        </div>
      )}
      {state.viewer && (
        <div className="flex items-center justify-center gap-2 px-1">
          <p className="text-center text-[11px] text-muted-foreground">
            Tap a player to vote. Changed your mind? Tap another one until the gavel falls. Ballots are public.
          </p>
          <InfoTip help={BALLOT_HELP} side="top" align="end" />
        </div>
      )}
    </Tabs>
  )
}

interface CategoryBallotProps {
  state: ClockedTribunal
  category: Category
  selfId: string | null
  onVote?: (playerId: string) => void
}

function CategoryBallot({ state, category, selfId, onVote }: CategoryBallotProps) {
  const tone = TONES[category]
  const tallies = state.tallies[category]
  const total = state.ballots[category]
  const top = Math.max(0, ...Object.values(tallies))
  const leaders = top > 0 ? Object.keys(tallies).filter((id) => tallies[id] === top) : []
  const otherPick = state.mine[category === "mvp" ? "inter" : "mvp"]

  const reason = (c: Candidate) => {
    if (!onVote) return null
    if (c.playerId === selfId) return "That's you"
    if (c.playerId === otherPick) return category === "mvp" ? "Your Inter" : "Your MVP"
    return null
  }

  return (
    <>
      <CandidateGrid
        candidates={state.candidates}
        category={category}
        label={CATEGORY_COPY[category].voteTitle}
        selectedId={state.mine[category]}
        highlightIds={leaders}
        onSelect={onVote}
        disabledReason={reason}
        share={(c) => (total > 0 ? (tallies[c.playerId] ?? 0) / total : 0)}
        describe={(c) => `${CATEGORY_COPY[category].voteVerb} ${c.name} (${c.champion}). ${tallies[c.playerId] ?? 0} votes so far.`}
        aside={(c) => (
          <span className="flex flex-col items-end leading-none">
            <AnimatedNumber
              value={tallies[c.playerId] ?? 0}
              className={cn("text-base font-bold", (tallies[c.playerId] ?? 0) > 0 ? tone.text : "text-muted-foreground/60")}
            />
            <span className="mt-0.5 hidden text-[9px] tracking-wider text-muted-foreground uppercase sm:block">votes</span>
          </span>
        )}
      />
      <VoterRoll voters={state.voters[category]} tallies={tallies} candidates={state.candidates} category={category} />
    </>
  )
}

function VoterRoll({
  voters,
  tallies,
  candidates,
  category,
}: {
  voters: Record<string, VoterView[]>
  tallies: Record<string, number>
  candidates: Candidate[]
  category: Category
}) {
  const rows = candidates
    .filter((c) => (tallies[c.playerId] ?? 0) > 0)
    .sort((a, b) => (tallies[b.playerId] ?? 0) - (tallies[a.playerId] ?? 0))
  if (rows.length === 0) {
    return <p className="px-1 text-center text-xs text-muted-foreground">No ballots yet. The court is still finding its seat.</p>
  }
  const tone = TONES[category]
  return (
    <ul aria-label="Who voted for whom" className="space-y-1">
      {rows.map((c) => {
        const list = voters[c.playerId] ?? []
        return (
          <li key={c.playerId} className="flex min-h-9 items-center gap-2 rounded-lg bg-[var(--color-navy)]/50 px-2.5 py-1">
            <span className={cn("w-6 shrink-0 text-right text-xs font-bold tabular-nums", tone.text)}>{tallies[c.playerId]}</span>
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{c.name}</span>
            <AvatarGroup className="shrink-0">
              {list.slice(0, 4).map((v) => (
                <Avatar key={v.userId} size="sm" title={v.name}>
                  {v.avatarUrl && <AvatarImage src={v.avatarUrl} alt={v.name} />}
                  <AvatarFallback>{v.name.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
              ))}
              {list.length > 4 && <AvatarGroupCount className="size-6 text-[10px]">+{list.length - 4}</AvatarGroupCount>}
            </AvatarGroup>
          </li>
        )
      })}
    </ul>
  )
}
