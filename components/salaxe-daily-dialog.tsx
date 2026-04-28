"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { getRandomQuote } from "@/lib/salaxe-quotes"
import { useState, useMemo } from "react"

interface SalaxeDailyDialogProps {
  open: boolean
  onDismiss: () => void
  username: string
}

export function SalaxeDailyDialog({
  open,
  onDismiss,
  username,
}: SalaxeDailyDialogProps) {
  const [dismissed, setDismissed] = useState(false)
  const quote = useMemo(() => getRandomQuote(), [])

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss()
  }

  if (dismissed) return null

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent className="border-2 border-[var(--color-gold)] bg-[var(--color-navy)] shadow-[0_0_40px_rgba(200,155,60,0.3)]">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-black tracking-wider text-[var(--color-gold)]">
            {quote.title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-center text-sm leading-relaxed text-[var(--color-gold-light)]">
            {quote.body(username)}
          </p>
          <div className="flex justify-center">
            <div className="rounded-full bg-[var(--color-gold)]/10 px-4 py-1 text-lg font-bold text-[var(--color-gold)]">
              +5 points
            </div>
          </div>
        </div>
        <div className="flex justify-center pt-2">
          <Button
            onClick={handleDismiss}
            className="bg-[var(--color-gold)] font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)]"
          >
            {quote.dismiss}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
