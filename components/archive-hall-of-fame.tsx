"use client"

import Image from "next/image"
import type { ActAward } from "@/lib/types"

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  treasury: {
    label: "The Treasury",
    icon: "👑",
    color: "border-[var(--color-gold)] shadow-[0_0_20px_rgba(200,155,60,0.3)]",
  },
  grand_champion: {
    label: "Grand Champion",
    icon: "👑",
    color: "border-[var(--color-gold)] shadow-[0_0_20px_rgba(200,155,60,0.3)]",
  },
  warrior: {
    label: "The Warrior",
    icon: "⚔️",
    color: "border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.2)]",
  },
  iron_man: {
    label: "The Iron Man",
    icon: "🛡️",
    color: "border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]",
  },
  degenerate: {
    label: "The Degenerate",
    icon: "🎲",
    color: "border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]",
  },
  devotee: {
    label: "The Devotee",
    icon: "🙏",
    color: "border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.2)]",
  },
  punching_bag: {
    label: "The Punching Bag",
    icon: "🥊",
    color: "border-orange-500/50 shadow-[0_0_15px_rgba(249,115,22,0.2)]",
  },
}

interface ArchiveHallOfFameProps {
  awards: (ActAward & {
    username?: string
    avatar_url?: string | null
    player_name?: string | null
  })[]
}

export function ArchiveHallOfFame({ awards }: ArchiveHallOfFameProps) {
  const grandChampion = awards.find(
    (a) => a.category === "treasury" || a.category === "grand_champion"
  )
  const otherAwards = awards.filter(
    (a) => a.category !== "grand_champion" && a.category !== "treasury"
  )

  return (
    <div className="space-y-8">
      {grandChampion && (
        <div className="flex flex-col items-center">
          <div
            className={`w-full max-w-md rounded-lg border-2 ${CATEGORY_CONFIG[grandChampion.category]?.color ?? ""} bg-[var(--color-navy-light)] p-6 text-center`}
          >
            <div className="mb-3 text-4xl">👑</div>
            <div className="flex justify-center">
              <div className="mb-3 flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-[var(--color-gold)] bg-[var(--color-navy)]">
                {grandChampion.avatar_url ? (
                  <Image
                    src={grandChampion.avatar_url}
                    alt=""
                    width={80}
                    height={80}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-[var(--color-gold)]">
                    ?
                  </span>
                )}
              </div>
            </div>
            <div className="text-xl font-bold text-[var(--color-gold)]">
              {grandChampion.player_name ?? grandChampion.username ?? "Unknown"}
            </div>
            <div className="mt-1 text-sm font-semibold text-[var(--color-gold-light)]">
              {grandChampion.title}
            </div>
            <div className="mt-2 text-2xl font-bold text-[var(--color-gold)]">
              {grandChampion.final_value}
            </div>
            {grandChampion.carry_over_bonus > 0 && (
              <div className="mt-2 text-xs text-[var(--color-gold-light)]/50">
                +{grandChampion.carry_over_bonus} carry-over bonus
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {otherAwards.map((award) => {
          const config = CATEGORY_CONFIG[award.category]
          return (
            <div
              key={award.id}
              className={`rounded-lg border ${config?.color ?? "border-[var(--color-gold)]/20"} bg-[var(--color-navy-light)] p-4 text-center`}
            >
              <div className="mb-2 text-2xl">{config?.icon ?? "🏆"}</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-gold-light)]/50">
                {config?.label ?? award.category}
              </div>
              <div className="mt-1 font-bold text-[var(--color-gold-light)]">
                {award.player_name ?? award.username ?? "Unknown"}
              </div>
              <div className="mt-1 text-lg font-bold text-[var(--color-gold)]">
                {award.final_value}
              </div>
              <div className="mt-1 text-xs text-[var(--color-gold-light)]/40">
                {award.title}
                {award.carry_over_bonus > 0 &&
                  ` (+${award.carry_over_bonus} bonus)`}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
