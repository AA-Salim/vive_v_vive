"use client"

import { useState, useMemo } from "react"
import { CrownIcon, MicIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useAct } from "@/hooks/use-act"
import { getActContent } from "@/lib/act-content"

interface KissTheHandProps {
  kissRemaining: number
  onKiss: () => Promise<{ kissed?: boolean; exhausted?: boolean } | null>
}

export function KissTheHand({ kissRemaining, onKiss }: KissTheHandProps) {
  const { act } = useAct()
  const content = useMemo(
    () => getActContent(act?.act_number ?? 2),
    [act]
  )
  const [loading, setLoading] = useState(false)
  const description = useMemo(
    () => content.getRandomPraiseDescription(),
    [content]
  )

  const handleKiss = async () => {
    if (loading) return
    setLoading(true)
    try {
      const result = await onKiss()
      if (result?.kissed) {
        toast.success(content.getRandomPraiseResponse())
      } else if (result?.exhausted) {
        toast.error(
          act && act.act_number >= 2
            ? "Salaxe's ears are ringing. Return tomorrow."
            : "The King's hand is weary. Return tomorrow."
        )
      }
    } catch {
      toast.error("Failed")
    } finally {
      setLoading(false)
    }
  }

  const exhausted = kissRemaining <= 0
  const isAct2 = act && act.act_number >= 2
  const Icon = isAct2 ? MicIcon : CrownIcon

  return (
    <div className="rounded-lg border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--color-gold)]" />
        <span className="text-sm font-bold uppercase tracking-wider text-[var(--color-gold)]">
          {content.praiseTitle}
        </span>
      </div>
      <p className="mb-3 text-xs text-[var(--color-gold-light)]/50">
        {exhausted ? content.praiseExhausted : description}
      </p>
      <div className="flex items-center gap-3">
        <Button
          onClick={handleKiss}
          disabled={exhausted || loading}
          size="sm"
          className="bg-[var(--color-gold)] font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)] disabled:opacity-40"
        >
          {loading
            ? content.praiseSinging
            : exhausted
              ? content.praiseExhaustedButton
              : content.praiseAction}
        </Button>
        <span className="text-xs text-[var(--color-gold-light)]/40">
          {kissRemaining}/3 left today
        </span>
      </div>
    </div>
  )
}

export const SingHisPraises = KissTheHand
