"use client"

import { Fragment, useId, useState } from "react"
import { AnswerButton, OPTION_TILE } from "@/components/praise/riddle/answer-button"
import type { SequencePuzzle as SequencePuzzleData } from "@/lib/praise/types"
import { cn } from "@/lib/utils"

interface SequencePuzzleProps {
  puzzle: SequencePuzzleData
  pending: boolean
  onAnswer: (answer: { value: number }) => void
}

export function SequencePuzzle({ puzzle, pending, onAnswer }: SequencePuzzleProps) {
  const [picked, setPicked] = useState<number | null>(null)
  const name = useId()

  return (
    <div className="space-y-4">
      <p className="sr-only">Sequence: {puzzle.terms.join(", ")}, then a missing number.</p>
      <div aria-hidden className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2">
        {puzzle.terms.map((term, index) => (
          <Fragment key={index}>
            <span className="inline-flex h-12 min-w-12 items-center justify-center rounded-lg border border-[var(--color-gold)]/25 bg-[var(--color-navy-lighter)] px-2.5 font-display text-xl tabular-nums text-[var(--color-gold-light)] sm:h-14 sm:min-w-14 sm:text-2xl">
              {term}
            </span>
            <span className="text-muted-foreground/60">,</span>
          </Fragment>
        ))}
        <span className="inline-flex h-12 min-w-12 animate-glow items-center justify-center rounded-lg border border-dashed border-[var(--color-gold)] bg-[var(--color-gold)]/10 px-2.5 font-display text-xl text-[var(--color-gold)] motion-reduce:animate-none sm:h-14 sm:min-w-14 sm:text-2xl">
          {picked ?? "?"}
        </span>
      </div>

      <fieldset className="space-y-2" disabled={pending}>
        <legend className="sr-only">
          Pick the next number
        </legend>
        <div className="grid grid-cols-2 gap-2">
          {puzzle.options.map((option) => (
            <label key={option} className={cn(OPTION_TILE, "h-14 font-display text-2xl tabular-nums")}>
              <input
                type="radio"
                name={name}
                value={option}
                checked={picked === option}
                onChange={() => setPicked(option)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && picked !== null) onAnswer({ value: picked })
                }}
                className="sr-only"
              />
              {option}
            </label>
          ))}
        </div>
      </fieldset>

      <AnswerButton ready={picked !== null} pending={pending} onClick={() => picked !== null && onAnswer({ value: picked })} />
    </div>
  )
}
