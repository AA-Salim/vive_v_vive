"use client"

import { useState } from "react"
import { ShuffleIcon, SparklesIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NAME_CHIPS, WORSHIP_WORDS } from "@/lib/praise/prompts"
import { WORSHIP_LABEL } from "@/lib/praise/voice"
import { cn } from "@/lib/utils"

const PAGE = 10

interface WorshipChipsProps {
  seed: number
  // Characters the praise still has room for, a separating space included.
  room: number
  showNames: boolean
  onPick: (word: string) => void
}

function Chip({ word, room, name, onPick }: { word: string; room: number; name?: boolean; onPick: (word: string) => void }) {
  const fits = Array.from(word).length <= room
  return (
    <button
      type="button"
      disabled={!fits}
      onClick={() => onPick(word)}
      title={fits ? undefined : "No room left in this line"}
      className={cn(
        "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
        name
          ? "border-[var(--color-gold)]/60 bg-[var(--color-gold)]/15 text-[var(--color-gold-light)] enabled:hover:bg-[var(--color-gold)]/25"
          : "border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 text-foreground/90 enabled:hover:border-[var(--color-gold)]/60 enabled:hover:bg-[var(--color-gold)]/10"
      )}
    >
      {word}
    </button>
  )
}

// Tappable words of worship (English, French, Darija). Words that would push the line past its limit are disabled.
export function WorshipChips({ seed, room, showNames, onPick }: WorshipChipsProps) {
  const [offset, setOffset] = useState(() => (seed % Math.ceil(WORSHIP_WORDS.length / PAGE)) * PAGE)
  const words = Array.from({ length: Math.min(PAGE, WORSHIP_WORDS.length) }, (_, i) => WORSHIP_WORDS[(offset + i) % WORSHIP_WORDS.length])

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-[var(--color-gold)]/30 bg-[var(--color-gold)]/5 p-2.5">
      <div className="flex items-center gap-2 pl-0.5">
        <SparklesIcon className="size-3.5 shrink-0 text-[var(--color-gold)]" aria-hidden />
        <p className="flex-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]/80">
          {WORSHIP_LABEL}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0 text-[var(--color-gold)]"
          aria-label="Show other words"
          onClick={() => setOffset((current) => (current + PAGE) % WORSHIP_WORDS.length)}
        >
          <ShuffleIcon aria-hidden />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={WORSHIP_LABEL}>
        {showNames && NAME_CHIPS.map((word) => <Chip key={`name:${word}`} word={word} room={room} name onPick={onPick} />)}
        {words.map((word) => (
          <Chip key={word} word={word} room={room} onPick={onPick} />
        ))}
      </div>
    </div>
  )
}
