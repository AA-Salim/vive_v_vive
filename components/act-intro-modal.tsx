"use client"

import { useState, useEffect } from "react"
import { useAct } from "@/hooks/use-act"
import { ACT2_STORY } from "@/lib/act2/story"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

export function ActIntroModal() {
  const { act } = useAct()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!act) return
    const key = `act-intro-seen-${act.act_number}`
    if (!localStorage.getItem(key)) {
      setOpen(true)
    }
  }, [act])

  function handleDismiss() {
    if (act) {
      localStorage.setItem(`act-intro-seen-${act.act_number}`, "true")
    }
    setOpen(false)
  }

  if (!act || act.act_number < 2) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleDismiss()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto border-[var(--color-gold)]/30 bg-[var(--color-navy)] p-0 shadow-[0_0_60px_rgba(200,155,60,0.15)]">
        <div className="p-8">
          <h2 className="mb-6 text-center text-xl font-bold tracking-wider text-[var(--color-gold)]">
            {ACT2_STORY.title}
          </h2>
          <div className="space-y-4">
            {ACT2_STORY.paragraphs.map((p, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed text-[var(--color-gold-light)]/80"
              >
                {p}
              </p>
            ))}
          </div>
          <p className="mt-6 text-center text-sm font-bold italic text-[var(--color-gold)]">
            {ACT2_STORY.closing}
          </p>
          <div className="mt-8 flex justify-center">
            <Button
              onClick={handleDismiss}
              className="bg-[var(--color-gold)] px-8 text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)]"
            >
              {ACT2_STORY.dismissButton}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
