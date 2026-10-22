"use client"

import { Zap } from "lucide-react"
import { LoadoutButton } from "@/components/titles/loadout-dialog"
import { useAuth } from "@/hooks/use-auth"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import { summarizeLoadout } from "@/lib/titles/effects"
import { cn } from "@/lib/utils"

interface LoadoutSummaryBarProps {
  userId: string | null
  name?: string | null
  className?: string
}

// The one-line build of a player plus the button to open it: "Manage loadout" for yourself, "See their strategy" for anyone else.
export function LoadoutSummaryBar({ userId, name, className }: LoadoutSummaryBarProps) {
  const { user } = useAuth()
  const { byUserId } = useEquippedTitles()
  const isSelf = !!user && !!userId && user.id === userId
  if (!userId) return null
  const summary = summarizeLoadout(byUserId.get(userId))

  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-gold)]/20 bg-[var(--color-navy)]/60 px-2.5 py-2", className)}>
      <p className="flex min-w-0 flex-1 items-start gap-1.5 text-xs leading-snug text-[var(--color-gold-light)]/85">
        <Zap aria-hidden className="mt-0.5 size-3.5 shrink-0 text-[var(--color-gold)]" />
        <span className="min-w-0">
          {summary.text ||
            (isSelf ? "No title bends the rules for you yet." : `No title bends the rules for ${name ?? "them"} right now.`)}
        </span>
      </p>
      <LoadoutButton userId={userId} isSelf={isSelf} name={name} className="shrink-0" />
    </div>
  )
}
