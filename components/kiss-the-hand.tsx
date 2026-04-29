"use client"

import { useState, useMemo } from "react"
import { CrownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { getRandomKissResponse, getRandomKissDescription } from "@/lib/salaxe-kiss-responses"

interface KissTheHandProps {
  kissRemaining: number
  onKiss: () => Promise<{ kissed?: boolean; exhausted?: boolean } | null>
}

export function KissTheHand({ kissRemaining, onKiss }: KissTheHandProps) {
  const [loading, setLoading] = useState(false)
  const description = useMemo(() => getRandomKissDescription(), [])

  const handleKiss = async () => {
    if (loading) return
    setLoading(true)
    try {
      const result = await onKiss()
      if (result?.kissed) {
        toast.success(getRandomKissResponse())
      } else if (result?.exhausted) {
        toast.error("The King's hand is weary. Return tomorrow.")
      }
    } catch {
      toast.error("Failed to kiss the royal hand")
    } finally {
      setLoading(false)
    }
  }

  const exhausted = kissRemaining <= 0

  return (
    <div className="rounded-lg border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <CrownIcon className="h-4 w-4 text-[var(--color-gold)]" />
        <span className="text-sm font-bold uppercase tracking-wider text-[var(--color-gold)]">
          Kiss the Royal Hand
        </span>
      </div>
      <p className="mb-3 text-xs text-[var(--color-gold-light)]/50">
        {exhausted
          ? "You have shown sufficient devotion for today."
          : description}
      </p>
      <div className="flex items-center gap-3">
        <Button
          onClick={handleKiss}
          disabled={exhausted || loading}
          size="sm"
          className="bg-[var(--color-gold)] font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)] disabled:opacity-40"
        >
          {loading ? "Kissing..." : exhausted ? "Hand Weary" : "Kiss the Hand"}
        </Button>
        <span className="text-xs text-[var(--color-gold-light)]/40">
          {kissRemaining}/3 left today
        </span>
      </div>
    </div>
  )
}
