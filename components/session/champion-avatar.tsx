"use client"

import Image from "next/image"
import { LockIcon } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { getChampionImageUrl, type Champion } from "@/lib/champions"
import type { PlayerRevealState, Side } from "@/lib/types"
import type { RoomAssignment } from "@/lib/session/types"
import { cn } from "@/lib/utils"

interface ChampionAvatarProps {
  assignment: RoomAssignment
  state?: PlayerRevealState
  shuffleChampion?: Champion | null
  size: number
  rounded?: "md" | "full"
  className?: string
  showLock?: boolean
}

export const SIDE_RING: Record<Side, string> = {
  blue: "ring-[var(--color-blue-team)]",
  red: "ring-[var(--color-red-team)]",
}

const SIDE_GLOW: Record<Side, string> = {
  blue: "bg-[radial-gradient(circle,var(--color-blue-team)_0%,transparent_70%)]",
  red: "bg-[radial-gradient(circle,var(--color-red-team)_0%,transparent_70%)]",
}

export function ChampionAvatar({
  assignment,
  state = "revealed",
  shuffleChampion,
  size,
  rounded = "md",
  className,
  showLock = false,
}: ChampionAvatarProps) {
  const reduced = useReducedMotion()
  const shuffling = state === "shuffling" && !!shuffleChampion
  const internal = shuffling && shuffleChampion ? shuffleChampion.internal : assignment.champion_internal
  const concealed = state === "silhouette" || state === "hidden"
  const revealed = state === "revealed" || state === "locking"

  return (
    <motion.span
      className={cn(
        "relative block shrink-0 bg-muted ring-2",
        SIDE_RING[assignment.side],
        rounded === "full" ? "rounded-full" : "rounded-md",
        className
      )}
      style={{ width: size, height: size }}
      animate={state === "locking" && !reduced ? { scale: [1.22, 0.96, 1] } : { scale: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <span className={cn("relative block size-full overflow-hidden", rounded === "full" ? "rounded-full" : "rounded-md")}>
        {concealed ? (
          <span
            aria-hidden
            className="flex size-full animate-pulse items-center justify-center bg-[radial-gradient(circle_at_50%_30%,var(--color-navy-lighter),var(--color-navy))] font-display font-bold text-[var(--color-gold)]/60"
            style={{ fontSize: Math.round(size * 0.42) }}
          >
            ?
          </span>
        ) : (
          <AnimatePresence initial={false}>
            <motion.span
              key={shuffling ? "shuffle" : internal}
              className="absolute inset-0 block"
              initial={reduced ? false : { opacity: 0, scale: 1.3, filter: "brightness(1.8)" }}
              animate={{ opacity: 1, scale: 1, filter: "brightness(1)" }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <Image
                src={getChampionImageUrl(internal)}
                alt={revealed ? assignment.champion : ""}
                width={size}
                height={size}
                unoptimized
                draggable={false}
                className={cn("size-full scale-110 object-cover", shuffling && "saturate-150")}
              />
            </motion.span>
          </AnimatePresence>
        )}
      </span>
      {state === "locking" && !reduced && (
        <motion.span
          aria-hidden
          className={cn("pointer-events-none absolute -inset-3 rounded-full", SIDE_GLOW[assignment.side])}
          initial={{ opacity: 0.95, scale: 0.6 }}
          animate={{ opacity: 0, scale: 1.4 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        />
      )}
      {showLock && assignment.locked && revealed && (
        <span className="absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full border border-[var(--color-gold)] bg-[var(--color-navy)] text-[var(--color-gold)] shadow">
          <LockIcon className="size-3" aria-hidden />
          <span className="sr-only">Locked</span>
        </span>
      )}
    </motion.span>
  )
}
