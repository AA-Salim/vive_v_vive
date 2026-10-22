"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { BotIcon, PinIcon } from "lucide-react"
import { LaneIcon } from "@/components/lane-icon"
import { ChampionArt } from "@/components/lobby/champion-pick/champion-art"
import { ROLE_LABELS } from "@/lib/champions"
import type { ChampionPickView, ChampionRequestView, ChampionSlot } from "@/lib/lobby/champion-pick"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

const TONE: Record<Side, { title: string; header: string; ring: string; card: string; glow: string }> = {
  blue: {
    title: "text-[var(--color-blue-team)]",
    header: "border-[var(--color-blue-team)]/45",
    ring: "ring-[var(--color-blue-team)]/70",
    card: "border-[var(--color-blue-team)]/30 bg-[var(--color-blue-team)]/[0.07]",
    glow: "bg-[radial-gradient(circle,var(--color-blue-team)_0%,transparent_70%)]",
  },
  red: {
    title: "text-[var(--color-red-team)]",
    header: "border-[var(--color-red-team)]/45",
    ring: "ring-[var(--color-red-team)]/70",
    card: "border-[var(--color-red-team)]/30 bg-[var(--color-red-team)]/[0.07]",
    glow: "bg-[radial-gradient(circle,var(--color-red-team)_0%,transparent_70%)]",
  },
}

interface TeamBoardProps {
  side: Side
  coachName: string
  slots: ChampionSlot[]
  picks: Map<string, ChampionPickView>
  requests: Map<string, ChampionRequestView>
  selectable: boolean
  selectedId: string | null
  onSelect: (playerId: string) => void
  meUserId: string | null
  onClock: boolean
  unavailable: (champion: string) => boolean
}

function Portrait({ side, pick, request }: { side: Side; pick: ChampionPickView | undefined; request: ChampionRequestView | undefined }) {
  const reduced = useReducedMotion()
  const tone = TONE[side]
  return (
    <span className={cn("relative size-11 shrink-0 rounded-md ring-2", pick ? tone.ring : "ring-border")}>
      <span className="absolute inset-0 overflow-hidden rounded-md">
        <AnimatePresence initial={false}>
          {pick ? (
            <motion.span
              key={pick.champion}
              className="absolute inset-0"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.45, filter: "brightness(2)" }}
              animate={{ opacity: pick.id.startsWith("pending-") ? 0.6 : 1, scale: 1, filter: "brightness(1)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <ChampionArt internal={pick.champion_internal} name={pick.champion} decorative />
            </motion.span>
          ) : request ? (
            <motion.span key={`request-${request.champion}`} className="absolute inset-0 opacity-45 grayscale-[35%]" initial={{ opacity: 0 }} animate={{ opacity: 0.45 }} exit={{ opacity: 0 }}>
              <ChampionArt internal={request.champion_internal} name={request.champion} decorative />
            </motion.span>
          ) : (
            <motion.span key="empty" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,var(--color-navy-lighter),var(--color-navy))]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          )}
        </AnimatePresence>
      </span>
      <AnimatePresence>
        {pick && !reduced && !pick.id.startsWith("pending-") && (
          <motion.span
            key={`burst-${pick.champion}`}
            aria-hidden
            className={cn("pointer-events-none absolute -inset-3 rounded-full", tone.glow)}
            initial={{ opacity: 0.9, scale: 0.6 }}
            animate={{ opacity: 0, scale: 1.5 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        )}
      </AnimatePresence>
      {request && !pick && (
        <span className="absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full border border-[var(--color-gold)] bg-[var(--color-navy)] text-[var(--color-gold)]">
          <PinIcon className="size-3" aria-hidden />
        </span>
      )}
    </span>
  )
}

export function TeamBoard({ side, coachName, slots, picks, requests, selectable, selectedId, onSelect, meUserId, onClock, unavailable }: TeamBoardProps) {
  const tone = TONE[side]
  return (
    <section aria-label={`${side === "blue" ? "Blue" : "Red"} side, coached by ${coachName}`} className="flex min-w-0 flex-col gap-2">
      <header className={cn("flex items-baseline justify-between gap-2 border-b pb-1.5", tone.header)}>
        <span className={cn("font-display text-sm font-semibold uppercase tracking-[0.16em]", tone.title)}>{side === "blue" ? "Blue" : "Red"}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
          {onClock && <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-gold)] motion-safe:animate-pulse" aria-hidden />}
          <span className="truncate">
            <span className="max-sm:sr-only">Coach </span>
            {coachName}
          </span>
        </span>
      </header>
      <ol className="flex flex-col gap-1.5">
        {slots.map((slot) => {
          const pick = picks.get(slot.player_id)
          const request = requests.get(slot.player_id)
          const canSelect = selectable && !pick
          const selected = canSelect && selectedId === slot.player_id
          const me = !!meUserId && slot.user_id === meUserId
          const status = pick
            ? pick.champion
            : request
              ? unavailable(request.champion)
                ? `Wanted ${request.champion}: gone`
                : `Wants ${request.champion}`
              : selected
                ? "Choosing a champion"
                : "No champion yet"
          return (
            <li key={slot.player_id} className="min-w-0">
              <button
                type="button"
                disabled={!canSelect}
                aria-pressed={canSelect ? selected : undefined}
                onClick={() => onSelect(slot.player_id)}
                className={cn(
                  "flex min-h-14 w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
                  tone.card,
                  canSelect && "cursor-pointer hover:border-[var(--color-gold)]/60",
                  !canSelect && "cursor-default",
                  selected && "border-[var(--color-gold)] bg-[var(--color-gold)]/12 shadow-[0_0_18px_-6px_var(--color-gold)]",
                  me && !selected && "border-[var(--color-gold)]/45"
                )}
              >
                <Portrait side={side} pick={pick} request={request} />
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1">
                    {slot.lane && <LaneIcon lane={slot.lane} size={12} title={null} className="shrink-0 text-[var(--color-gold-light)]/70" />}
                    <span className="min-w-0 truncate text-sm font-medium text-foreground">{slot.name}</span>
                    {me && <span className="shrink-0 text-[10px] font-semibold uppercase text-[var(--color-gold)]">You</span>}
                  </span>
                  <span
                    className={cn(
                      "flex min-w-0 items-center gap-1 text-[11px]",
                      pick ? "font-semibold text-[var(--color-gold-light)]" : request ? "text-[var(--color-gold)]/85" : "text-muted-foreground"
                    )}
                  >
                    {pick?.auto && <BotIcon className="size-3 shrink-0" aria-label="Picked by the clock" />}
                    <span className="truncate">{status}</span>
                  </span>
                  <span className="sr-only">{slot.lane ? `, ${ROLE_LABELS[slot.lane]}` : ""}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
