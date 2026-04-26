"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { findChampion, getChampionImageUrl } from "@/lib/champions"

interface FearlessPanelProps {
  refreshKey?: number
}

export function FearlessPanel({ refreshKey }: FearlessPanelProps) {
  const [champions, setChampions] = useState<string[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch("/api/fearless")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setChampions(data)
      })
      .catch(() => {})
  }, [refreshKey])

  if (champions.length === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-lg border border-[var(--color-gold)]/10 bg-[var(--color-navy-light)] px-4 py-2 text-sm text-[var(--color-gold-light)]/70 transition-colors hover:bg-[var(--color-navy-lighter)]">
        <span className="flex-1 text-left">
          Fearless Draft: {champions.length} champion
          {champions.length !== 1 ? "s" : ""} banned today
        </span>
        <span className="text-xs">{open ? "▲" : "▼"}</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-[var(--color-gold)]/10 bg-[var(--color-navy-light)] p-4">
          {champions.map((name) => {
            const champ = findChampion(name)
            const internal = champ?.internal ?? name
            return (
              <div
                key={name}
                className="flex flex-col items-center gap-0.5"
                title={name}
              >
                <div className="overflow-hidden rounded-full opacity-40 grayscale">
                  <Image
                    src={getChampionImageUrl(internal)}
                    alt={name}
                    width={32}
                    height={32}
                    className="h-8 w-8 object-cover"
                    unoptimized
                  />
                </div>
                <span className="max-w-[48px] truncate text-[9px] text-[var(--color-gold-light)]/40">
                  {name}
                </span>
              </div>
            )
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
