"use client"

import { Flame, Skull } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import { TitleBadge } from "@/components/title-badge"
import { PerkLine } from "@/components/titles/perk-line"
import { cn } from "@/lib/utils"
import type { OwnedTitleView, TitleView } from "@/lib/titles/types"

interface CurseCardProps {
  title: TitleView
  owned: OwnedTitleView
  locked: boolean
  migrated: boolean
  onDignity: (title: TitleView, owned: OwnedTitleView) => void
}

export function CurseCard({ title, owned, locked, migrated, onDignity }: CurseCardProps) {
  const reduce = useReducedMotion()
  const curse = owned.curse
  if (!curse) return null
  const bestower = owned.bestowed_by?.name ?? "a mystery noble"

  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.96 }}
      className="relative overflow-hidden rounded-lg border border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-transparent to-transparent p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TitleBadge
          name={title.name}
          category={title.category}
          perk={owned.perk}
          size="md"
          curse={{ bestowedBy: bestower, gamesLeft: curse.left }}
          description={title.description}
          interactive
        />
        <span className="text-[11px] text-rose-200/80">by {bestower}</span>
      </div>
      <PerkLine perk={owned.perk} className="mt-2" />
      <div className="mt-3 flex items-center gap-2">
        <div
          role="img"
          aria-label={`${curse.left} of ${curse.total} games left`}
          className="flex flex-1 gap-1"
        >
          {Array.from({ length: curse.total }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                i < curse.served ? "bg-rose-950/80 ring-1 ring-rose-500/20" : "bg-rose-400/80"
              )}
            />
          ))}
        </div>
        <span className="shrink-0 text-[11px] font-semibold text-rose-200 tabular-nums">
          {curse.left} game{curse.left === 1 ? "" : "s"} left
        </span>
      </div>
      <Button
        variant="destructive"
        className="mt-3 h-10 w-full gap-2"
        disabled={locked || !migrated}
        onClick={() => onDignity(title, owned)}
      >
        <Flame aria-hidden />
        {migrated ? `Buy back your dignity · ${curse.dignity_cost} pts` : "Dignity buybacks open soon"}
      </Button>
      <Skull aria-hidden className="pointer-events-none absolute -top-4 right-16 size-20 rotate-12 text-rose-500/[0.06]" />
    </motion.div>
  )
}
