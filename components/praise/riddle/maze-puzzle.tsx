"use client"

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react"
import { CrownIcon, DropletIcon } from "lucide-react"
import { AnswerButton } from "@/components/praise/riddle/answer-button"
import { mazeFlow, TILE_NAMES } from "@/lib/praise/riddle"
import type { MazePuzzle as MazePuzzleData } from "@/lib/praise/types"
import { RIDDLE_COPY } from "@/lib/praise/voice"
import { cn } from "@/lib/utils"

// Long enough to see the water reach the crown before the answer goes out.
const SUBMIT_DELAY_MS = 600

// Each pipe drawn unrotated in a 100x100 box: I runs north-south, L north-east, T north-east-south.
function PipeShape({ type }: { type: string }) {
  if (type === "I") return <path d="M50 0V100" />
  if (type === "L") return <path d="M50 0V50H100" />
  return <path d="M50 0V100M50 50H100" />
}

function moveFocus(key: string, cell: number, size: number): number | null {
  const row = Math.floor(cell / size)
  const col = cell % size
  if (key === "ArrowRight") return col < size - 1 ? cell + 1 : cell
  if (key === "ArrowLeft") return col > 0 ? cell - 1 : cell
  if (key === "ArrowDown") return row < size - 1 ? cell + size : cell
  if (key === "ArrowUp") return row > 0 ? cell - size : cell
  if (key === "Home") return row * size
  if (key === "End") return row * size + size - 1
  return null
}

interface MazePuzzleProps {
  puzzle: MazePuzzleData
  pending: boolean
  onAnswer: (answer: { rotations: number[] }) => void
}

export function MazePuzzle({ puzzle, pending, onAnswer }: MazePuzzleProps) {
  const { size, tiles, entry, exit } = puzzle
  // Quarter turns only ever grow, so a tile always spins clockwise even when it wraps back to 0.
  const [turns, setTurns] = useState<number[]>(() => puzzle.rotations.slice())
  const [focused, setFocused] = useState(entry * size)
  const [sent, setSent] = useState(false)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const answerRef = useRef(onAnswer)
  const hintId = useId()

  const rotations = useMemo(() => turns.map((turn) => turn % 4), [turns])
  const flow = useMemo(() => mazeFlow(puzzle, rotations), [puzzle, rotations])
  const connected = flow.connected

  useEffect(() => {
    answerRef.current = onAnswer
  }, [onAnswer])

  useEffect(() => {
    if (!connected || sent) return
    const timer = setTimeout(() => {
      setSent(true)
      answerRef.current({ rotations })
    }, SUBMIT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [connected, sent, rotations])

  const rotate = (cell: number) => {
    if (pending) return
    setSent(false)
    setTurns((current) => current.map((turn, index) => (index === cell ? turn + 1 : turn)))
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, cell: number) => {
    const next = moveFocus(event.key, cell, size)
    if (next === null) return
    event.preventDefault()
    setFocused(next)
    buttons.current[next]?.focus()
  }

  const marker = (row: number) => ({ top: `${((row + 0.5) / size) * 100}%` })

  return (
    <div className="space-y-3">
      <p id={hintId} className="sr-only">
        Water enters on the left of row {entry + 1} and must reach the crown on the right of row {exit + 1}. Arrow keys move
        between pipes, Enter or Space turns one a quarter clockwise.
      </p>
      <div className="relative mx-auto w-full max-w-[21rem] px-6">
        <span
          aria-hidden
          className="absolute left-0 flex w-6 -translate-y-1/2 items-center justify-end gap-0.5 text-[var(--color-hextech)]"
          style={marker(entry)}
        >
          <DropletIcon className="size-4" />
          <span className="h-1.5 w-1 rounded-l-sm bg-[var(--color-hextech)]" />
        </span>
        <span
          aria-hidden
          className={cn(
            "absolute right-0 flex w-6 -translate-y-1/2 items-center justify-start gap-0.5 transition-colors duration-300",
            connected ? "text-[var(--color-gold-bright)] drop-shadow-[0_0_6px_rgb(232_200_116/0.8)]" : "text-[var(--color-gold)]/60"
          )}
          style={marker(exit)}
        >
          <span className={cn("h-1.5 w-1 rounded-r-sm", connected ? "bg-[var(--color-hextech)]" : "bg-[var(--color-gold)]/40")} />
          <CrownIcon className="size-4" />
        </span>

        <div
          role="group"
          aria-label="Royal pipes"
          aria-describedby={hintId}
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
        >
          {Array.from(tiles, (type, cell) => {
            const lit = flow.reached.has(cell)
            const row = Math.floor(cell / size)
            const col = cell % size
            return (
              <button
                key={cell}
                ref={(element) => {
                  buttons.current[cell] = element
                }}
                type="button"
                tabIndex={cell === focused ? 0 : -1}
                aria-label={`Row ${row + 1}, column ${col + 1}, ${TILE_NAMES[type] ?? "pipe"}${lit ? ", water flowing" : ""}`}
                aria-disabled={pending || undefined}
                onClick={() => rotate(cell)}
                onKeyDown={(event) => onKeyDown(event, cell)}
                onFocus={() => setFocused(cell)}
                className={cn(
                  "relative aspect-square touch-manipulation overflow-hidden rounded-md border bg-[var(--color-navy)] outline-none transition-[border-color,background-color,box-shadow] duration-200 select-none focus-visible:ring-3 focus-visible:ring-ring/60 active:bg-[var(--color-navy-lighter)] motion-reduce:transition-none",
                  lit
                    ? "border-[var(--color-hextech)]/45 bg-[var(--color-hextech-deep)]/25"
                    : "border-[var(--color-gold)]/15 hover:border-[var(--color-gold)]/40",
                  connected && lit && "shadow-[0_0_12px_-2px_rgb(10_200_185/0.55)]"
                )}
              >
                <svg
                  viewBox="0 0 100 100"
                  aria-hidden
                  className="absolute inset-0 size-full transition-transform duration-200 ease-hextech motion-reduce:transition-none"
                  style={{ transform: `rotate(${turns[cell] * 90}deg)` }}
                >
                  <g fill="none" strokeWidth={24} stroke={lit ? "var(--color-hextech)" : "var(--color-gold-dark)"}>
                    <PipeShape type={type} />
                  </g>
                  <g fill="none" strokeWidth={8} stroke={lit ? "#b8fff6" : "var(--color-gold)"} opacity={lit ? 0.85 : 0.35}>
                    <PipeShape type={type} />
                  </g>
                  <circle cx="50" cy="50" r="15" fill={lit ? "var(--color-hextech)" : "var(--color-gold-dark)"} />
                  <circle cx="50" cy="50" r="6" fill={lit ? "#b8fff6" : "var(--color-gold)"} opacity={lit ? 0.9 : 0.4} />
                </svg>
              </button>
            )
          })}
        </div>
      </div>

      <p aria-live="polite" className="min-h-4 text-center text-xs text-[var(--color-hextech)]">
        {connected ? RIDDLE_COPY.connected : ""}
      </p>
      {connected && sent && !pending && (
        <AnswerButton ready pending={pending} onClick={() => answerRef.current({ rotations })} />
      )}
    </div>
  )
}
