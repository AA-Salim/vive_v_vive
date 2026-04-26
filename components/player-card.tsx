import Image from "next/image"
import { getChampionImageUrl, ROLE_LABELS } from "@/lib/champions"
import type { Assignment } from "@/lib/types"
import { LaneIcon } from "./lane-icon"
import { cn } from "@/lib/utils"

interface PlayerCardProps {
  assignment: Assignment
  showLock?: boolean
  onToggleLock?: () => void
  isShuffling?: boolean
  shuffleImageUrl?: string
  compact?: boolean
}

export function PlayerCard({
  assignment,
  showLock = false,
  onToggleLock,
  isShuffling = false,
  shuffleImageUrl,
  compact = false,
}: PlayerCardProps) {
  const imageUrl = isShuffling && shuffleImageUrl
    ? shuffleImageUrl
    : getChampionImageUrl(assignment.championInternal)
  const imgSize = compact ? 48 : 48

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg p-2 transition-colors",
        assignment.fearlessOverride && "ring-1 ring-yellow-500/50"
      )}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full",
          assignment.side === "blue"
            ? "ring-2 ring-[var(--color-blue-team)]"
            : "ring-2 ring-[var(--color-red-team)]",
          isShuffling && "animate-champion-shuffle"
        )}
        style={{ width: imgSize, height: imgSize }}
      >
        <Image
          src={imageUrl}
          alt={assignment.champion}
          width={imgSize}
          height={imgSize}
          className="h-full w-full object-cover"
          unoptimized
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <LaneIcon lane={assignment.lane} size={14} className="shrink-0 text-[var(--color-gold)]/70" />
          <span className="text-xs text-[var(--color-gold)]/70">
            {ROLE_LABELS[assignment.lane]}
          </span>
          {assignment.fearlessOverride && (
            <span className="text-[10px] text-yellow-500">!</span>
          )}
        </div>
        <p className="truncate text-sm font-medium text-[var(--color-gold-light)]">
          {assignment.champion}
        </p>
        <p className="truncate text-xs text-[var(--color-gold-light)]/60">
          {assignment.player.name}
        </p>
      </div>
      {showLock && onToggleLock && (
        <button
          onClick={onToggleLock}
          className={cn(
            "shrink-0 rounded p-1 text-sm transition-colors",
            assignment.locked
              ? "text-[var(--color-gold)]"
              : "text-[var(--color-gold-light)]/30 hover:text-[var(--color-gold-light)]/60"
          )}
          title={assignment.locked ? "Unlock" : "Lock"}
        >
          {assignment.locked ? "🔒" : "🔓"}
        </button>
      )}
    </div>
  )
}
