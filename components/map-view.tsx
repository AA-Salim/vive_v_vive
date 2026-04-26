"use client"

import Image from "next/image"
import { getChampionImageUrl, ROLE_LABELS } from "@/lib/champions"
import type { Assignment, Role } from "@/lib/types"
import { cn } from "@/lib/utils"

interface MapViewProps {
  assignments: Assignment[]
  visiblePlayerIds?: Set<string>
  shufflingPlayerIds?: Set<string>
  shuffleImageUrls?: Map<string, string>
}

const BLUE_POSITIONS: Record<Role, { top: string; left: string }> = {
  top: { top: "28%", left: "10%" },
  jungle: { top: "55%", left: "28%" },
  mid: { top: "58%", left: "38%" },
  adc: { top: "90%", left: "58%" },
  support: { top: "86%", left: "50%" },
}

const RED_POSITIONS: Record<Role, { top: string; left: string }> = {
  top: { top: "10%", left: "42%" },
  jungle: { top: "40%", left: "68%" },
  mid: { top: "38%", left: "58%" },
  adc: { top: "65%", left: "90%" },
  support: { top: "70%", left: "84%" },
}

function MapOverlay({
  assignment,
  position,
  isVisible,
  isShuffling,
  shuffleImageUrl,
}: {
  assignment: Assignment
  position: { top: string; left: string }
  isVisible: boolean
  isShuffling?: boolean
  shuffleImageUrl?: string
}) {
  if (!isVisible) return null

  const imageUrl =
    isShuffling && shuffleImageUrl
      ? shuffleImageUrl
      : getChampionImageUrl(assignment.championInternal)

  return (
    <div
      className="animate-player-enter absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ top: position.top, left: position.left }}
    >
      <div className="flex flex-col items-center gap-0.5">
        <div
          className={cn(
            "relative overflow-hidden rounded-full",
            assignment.side === "blue"
              ? "ring-[3px] ring-[var(--color-blue-team)] shadow-[0_0_12px_rgba(10,132,255,0.5)]"
              : "ring-[3px] ring-[var(--color-red-team)] shadow-[0_0_12px_rgba(255,69,58,0.5)]",
            isShuffling && "animate-champion-shuffle"
          )}
          style={{ width: 64, height: 64 }}
        >
          <Image
            src={imageUrl}
            alt={assignment.champion}
            width={64}
            height={64}
            className="h-full w-full object-cover"
            unoptimized
          />
        </div>
        <span className="max-w-[90px] truncate text-center text-[11px] font-bold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          {assignment.champion}
        </span>
        <span className="max-w-[90px] truncate text-center text-[10px] text-[var(--color-gold-light)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          {assignment.player.name}
        </span>
      </div>
    </div>
  )
}

export function MapView({
  assignments,
  visiblePlayerIds,
  shufflingPlayerIds,
  shuffleImageUrls,
}: MapViewProps) {
  return (
    <div className="hidden md:block">
      <div className="relative mx-auto aspect-square w-full max-w-[720px] overflow-hidden rounded-xl border-2 border-[var(--color-gold)]/20 shadow-2xl shadow-black/50">
        <Image
          src="https://ddragon.leagueoflegends.com/cdn/14.24.1/img/map/map11.png"
          alt="Summoner's Rift"
          fill
          className="object-cover"
          unoptimized
          priority
        />
        <div className="absolute inset-0 bg-black/20" />

        {assignments.map((assignment) => {
          const positions =
            assignment.side === "blue" ? BLUE_POSITIONS : RED_POSITIONS
          const position = positions[assignment.lane]
          const isVisible =
            !visiblePlayerIds || visiblePlayerIds.has(assignment.player.id)
          const isShuffling = shufflingPlayerIds?.has(assignment.player.id)

          return (
            <MapOverlay
              key={assignment.player.id}
              assignment={assignment}
              position={position}
              isVisible={isVisible}
              isShuffling={isShuffling}
              shuffleImageUrl={shuffleImageUrls?.get(assignment.player.id)}
            />
          )
        })}
      </div>
    </div>
  )
}
