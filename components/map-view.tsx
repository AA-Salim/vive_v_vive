"use client"

import Image from "next/image"
import { CrownIcon } from "lucide-react"
import { ChampionAvatar } from "@/components/session/champion-avatar"
import { outcomeFor, slotShuffle, slotState, type BoardViewProps } from "@/components/session/board-types"
import { SUMMONERS_RIFT_URL } from "@/lib/champions"
import type { Role, Side } from "@/lib/types"
import { cn } from "@/lib/utils"

const BLUE_POSITIONS: Record<Role, { top: number; left: number }> = {
  top: { top: 28, left: 9 },
  jungle: { top: 50, left: 25 },
  mid: { top: 60, left: 41 },
  support: { top: 83, left: 51 },
  adc: { top: 91, left: 64 },
}

// The Rift mirrors along its main diagonal: red sits where blue would be with the axes swapped.
function positionOf(side: Side, lane: Role) {
  const p = BLUE_POSITIONS[lane]
  return side === "blue" ? { top: `${p.top}%`, left: `${p.left}%` } : { top: `${p.left}%`, left: `${p.top}%` }
}

type MapViewProps = Pick<BoardViewProps, "assignments" | "frame" | "winner"> & { className?: string }

export function MapView({ assignments, frame, winner, className }: MapViewProps) {
  return (
    <div
      className={cn(
        "relative aspect-square w-full overflow-hidden rounded-xl border border-border shadow-2xl shadow-black/50",
        className
      )}
    >
      <Image src={SUMMONERS_RIFT_URL} alt="Summoner's Rift" fill unoptimized priority sizes="520px" className="object-cover" />
      <div className="absolute inset-0 bg-[var(--color-navy)]/40" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,var(--color-navy)_100%)] opacity-70" />
      <ul aria-hidden>
        {assignments.map((a) => {
          const state = slotState(frame, a.player_id)
          const shuffle = slotShuffle(frame, a.player_id)
          const outcome = outcomeFor(winner, a.side)
          const active = frame?.activeLane === a.lane
          const revealed = state === "revealed" || state === "locking"
          return (
            <li
              key={a.player_id}
              title={revealed ? `${a.champion} (${a.players.name})` : undefined}
              className={cn(
                "absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[top,left,opacity,box-shadow] duration-700 ease-out",
                active && "shadow-[0_0_22px_4px_var(--color-gold)]",
                outcome === "lost" && "opacity-60 grayscale-[40%]"
              )}
              style={positionOf(a.side, a.lane)}
            >
              <ChampionAvatar
                assignment={a}
                state={state}
                shuffleChampion={shuffle}
                size={42}
                rounded="full"
                className="ring-[3px] shadow-lg shadow-black/60"
              />
              {outcome === "won" && (
                <CrownIcon className="absolute -top-3.5 left-1/2 size-4 -translate-x-1/2 text-[var(--color-gold)] drop-shadow" aria-hidden />
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
