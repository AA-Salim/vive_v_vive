"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getRandomPhrase } from "@/lib/slaxe-phrases"

interface DebtPledgeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBalance: number
  onConfirm: () => void
}

export function DebtPledgeDialog({ open, onOpenChange, currentBalance, onConfirm }: DebtPledgeDialogProps) {
  const [phrase, setPhrase] = useState("")
  const [input, setInput] = useState("")

  useEffect(() => {
    if (open) {
      setPhrase(getRandomPhrase())
      setInput("")
    }
  }, [open])

  const matches = input.trim().toLowerCase() === phrase.toLowerCase()

  const handleConfirm = () => {
    if (!matches) return
    onConfirm()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-red-400">You Are In Debt</DialogTitle>
          <DialogDescription>
            Your balance: <span className="font-bold text-red-400">{currentBalance} pts</span>.
            To continue spending, pledge your allegiance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-[var(--color-gold)]/20 bg-[var(--color-navy)] p-4 text-center">
            <div className="mb-1 text-xs text-[var(--color-gold-light)]/50">Type exactly:</div>
            <div className="text-lg font-bold text-[var(--color-gold)]">&ldquo;{phrase}&rdquo;</div>
          </div>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type the phrase above..."
            className="w-full rounded-md border border-[var(--color-gold)]/20 bg-[var(--color-navy)] px-3 py-2 text-center text-sm text-[var(--color-gold-light)] placeholder:text-[var(--color-gold-light)]/30"
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches) handleConfirm()
            }}
          />

          {input.length > 0 && !matches && (
            <div className="text-center text-xs text-red-400/70">
              Doesn&apos;t match. Type it exactly.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!matches}
            className="bg-[var(--color-gold)] text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)]"
          >
            I Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
