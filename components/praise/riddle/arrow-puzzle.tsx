"use client"

import { useId, useState } from "react"
import { ArrowUpIcon, CrownIcon } from "lucide-react"
import { AnswerButton, OPTION_TILE } from "@/components/praise/riddle/answer-button"
import { ARROW_NAMES } from "@/lib/praise/riddle"
import type { ArrowPuzzle as ArrowPuzzleData } from "@/lib/praise/types"
import { cn } from "@/lib/utils"

// Compass layout, row by row: up left, up, up right, left, (centre), right, down left, down, down right.
const COMPASS = [7, 0, 1, 6, null, 2, 5, 4, 3] as const

export function Arrow({ direction, className }: { direction: number; className?: string }) {
  return (
    <ArrowUpIcon
      aria-hidden
      strokeWidth={2.5}
      className={cn("transition-transform duration-200 motion-reduce:transition-none", className)}
      style={{ transform: `rotate(${direction * 45}deg)` }}
    />
  )
}

interface ArrowPuzzleProps {
  puzzle: ArrowPuzzleData
  pending: boolean
  onAnswer: (answer: { value: number }) => void
}

export function ArrowPuzzle({ puzzle, pending, onAnswer }: ArrowPuzzleProps) {
  const [picked, setPicked] = useState<number | null>(null)
  const name = useId()

  return (
    <div className="space-y-4">
      <p className="sr-only">
        Arrows: {puzzle.arrows.map((direction) => ARROW_NAMES[direction]).join(", ")}, then a missing arrow.
      </p>
      <div aria-hidden className="flex items-center justify-center gap-1.5 sm:gap-2">
        {puzzle.arrows.map((direction, index) => (
          <span
            key={index}
            className="inline-flex size-12 items-center justify-center rounded-lg border border-[var(--color-gold)]/25 bg-[var(--color-navy-lighter)] text-[var(--color-gold-light)] sm:size-14"
          >
            <Arrow direction={direction} className="size-7 sm:size-8" />
          </span>
        ))}
        <span className="inline-flex size-12 animate-glow items-center justify-center rounded-lg border border-dashed border-[var(--color-gold)] bg-[var(--color-gold)]/10 font-display text-xl text-[var(--color-gold)] motion-reduce:animate-none sm:size-14">
          {picked === null ? "?" : <Arrow direction={picked} className="size-7 sm:size-8" />}
        </span>
      </div>

      <fieldset disabled={pending}>
        <legend className="sr-only">Pick the next arrow</legend>
        <div className="mx-auto grid w-full max-w-52 grid-cols-3 gap-2">
          {COMPASS.map((direction, index) =>
            direction === null ? (
              <span
                key="centre"
                aria-hidden
                className="flex aspect-square items-center justify-center rounded-full border border-[var(--color-gold)]/15 bg-[var(--color-gold)]/5 text-[var(--color-gold)]/70"
              >
                <CrownIcon className="size-6" />
              </span>
            ) : (
              <label key={index} className={cn(OPTION_TILE, "aspect-square min-h-14")}>
                <input
                  type="radio"
                  name={name}
                  value={direction}
                  checked={picked === direction}
                  onChange={() => setPicked(direction)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && picked !== null) onAnswer({ value: picked })
                  }}
                  aria-label={ARROW_NAMES[direction]}
                  className="sr-only"
                />
                <Arrow direction={direction} className="size-7" />
              </label>
            )
          )}
        </div>
      </fieldset>

      <AnswerButton ready={picked !== null} pending={pending} onClick={() => picked !== null && onAnswer({ value: picked })} />
    </div>
  )
}
