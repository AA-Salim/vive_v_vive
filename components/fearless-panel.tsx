"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"
import { findChampion, getChampionImageUrl } from "@/lib/champions"
import { XIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

interface FearlessPanelProps {
  refreshKey?: number
}

export function FearlessPanel({ refreshKey }: FearlessPanelProps) {
  const [champions, setChampions] = useState<string[]>([])
  const [open, setOpen] = useState(false)

  const fetchChampions = useCallback(() => {
    fetch("/api/fearless")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setChampions(data)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchChampions()
  }, [refreshKey, fetchChampions])

  const handleRemove = async (champion: string) => {
    const res = await fetch("/api/fearless", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ champion }),
    })
    if (res.ok) {
      setChampions((prev) => prev.filter((c) => c !== champion))
      toast.success(`Removed ${champion} from fearless`)
    }
  }

  const handleClearAll = async () => {
    const res = await fetch("/api/fearless", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
    if (res.ok) {
      setChampions([])
      toast.success("Cleared all fearless bans")
    }
  }

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
        <div className="mt-2 rounded-lg border border-[var(--color-gold)]/10 bg-[var(--color-navy-light)] p-4">
          <div className="mb-3 flex justify-end">
            <Button
              onClick={handleClearAll}
              variant="outline"
              size="sm"
              className="border-[var(--color-red-team)]/30 text-xs text-[var(--color-red-team)]"
            >
              <Trash2Icon className="mr-1 h-3 w-3" />
              Clear All
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {champions.map((name) => {
              const champ = findChampion(name)
              const internal = champ?.internal ?? name
              return (
                <div
                  key={name}
                  className="group relative flex flex-col items-center gap-0.5"
                  title={name}
                >
                  <div className="relative overflow-hidden rounded-full opacity-40 grayscale">
                    <Image
                      src={getChampionImageUrl(internal)}
                      alt={name}
                      width={32}
                      height={32}
                      className="h-8 w-8 object-cover"
                      unoptimized
                    />
                    <button
                      onClick={() => handleRemove(name)}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100"
                    >
                      <XIcon className="h-4 w-4 text-[var(--color-red-team)]" />
                    </button>
                  </div>
                  <span className="max-w-[48px] truncate text-[9px] text-[var(--color-gold-light)]/40">
                    {name}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
