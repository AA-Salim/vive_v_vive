"use client"

import { useState } from "react"
import Image from "next/image"
import { UserRoundIcon } from "lucide-react"
import type { CoachProfile } from "@/lib/lobby/types"
import type { Side } from "@/lib/types"
import { cn } from "@/lib/utils"

export function CoachAvatar({ profile, size = 32 }: { profile: CoachProfile | null; size?: number }) {
  const [failed, setFailed] = useState<string | null>(null)
  const url = profile?.discord_avatar_url ?? null
  if (url && failed !== url) {
    return (
      <Image
        src={url}
        alt=""
        width={size}
        height={size}
        unoptimized
        onError={() => setFailed(url)}
        className="shrink-0 rounded-full ring-1 ring-border"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground" style={{ width: size, height: size }} aria-hidden>
      <UserRoundIcon className="size-1/2" />
    </span>
  )
}

interface CoachSlotProps {
  side: Side
  profile: CoachProfile | null
  name: string | null
  active: boolean
  onSelect: () => void
}

export function CoachSlot({ side, profile, name, active, onSelect }: CoachSlotProps) {
  const blue = side === "blue"
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex min-h-16 min-w-0 flex-col gap-1.5 rounded-xl border p-2.5 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
        blue ? "border-[var(--color-blue-team)]/35 bg-[var(--color-blue-team)]/[0.07]" : "border-[var(--color-red-team)]/35 bg-[var(--color-red-team)]/[0.07]",
        active && (blue ? "border-[var(--color-blue-team)] ring-1 ring-[var(--color-blue-team)]" : "border-[var(--color-red-team)] ring-1 ring-[var(--color-red-team)]")
      )}
    >
      <span className={cn("text-[10px] font-semibold uppercase tracking-[0.18em]", blue ? "text-[var(--color-blue-team)]" : "text-[var(--color-red-team)]")}>
        {blue ? "Blue coach" : "Red coach"}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <CoachAvatar profile={profile} size={28} />
        <span className="min-w-0">
          <span className={cn("block truncate text-sm font-medium", name ? "text-foreground" : "text-muted-foreground")}>{name ?? "Not chosen"}</span>
          {profile && name !== profile.discord_username && <span className="block truncate text-[11px] text-muted-foreground">{profile.discord_username}</span>}
        </span>
      </span>
    </button>
  )
}
