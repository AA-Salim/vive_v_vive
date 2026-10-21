"use client"

import { useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { ScrollTextIcon } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { PraiseComposer } from "@/components/praise/praise-composer"
import { PraiseSuccess } from "@/components/praise/praise-success"
import { useSubmitPraise } from "@/hooks/use-praise"
import { normalizePraise, PRAISE_REWARD, ROYAL_FAVOR } from "@/lib/praise/rules"
import type { HallPage, SubmitResult } from "@/lib/praise/types"
import { COMPOSER_INTROS, COPY, seededPick } from "@/lib/praise/voice"

interface ComposerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  seed: number
  userId: string | null
  onOpenHall: () => void
}

export function ComposerDialog({ open, onOpenChange, seed, userId, onOpenHall }: ComposerDialogProps) {
  const queryClient = useQueryClient()
  const submit = useSubmitPraise(userId)
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const intro = seededPick(COMPOSER_INTROS, String(seed))

  const knownFingerprints = useMemo(() => {
    const pages = queryClient.getQueriesData<HallPage>({ queryKey: ["praise", "hall"] })
    return new Set(pages.flatMap(([, page]) => page?.praises.map((p) => normalizePraise(p.body)) ?? []))
  }, [queryClient])

  const handleSubmit = (body: string) => {
    setError(null)
    submit.mutate(body, {
      onSuccess: (data) => setResult(data),
      onError: (failure) => {
        if (failure.code === "already_sung") {
          toast(failure.message)
          onOpenChange(false)
          return
        }
        setError(failure.message)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        initialFocus={result ? undefined : textareaRef}
        className="top-3 max-h-[calc(100dvh-1.5rem)] translate-y-0 gap-5 overflow-y-auto overscroll-contain border border-[var(--color-gold)]/30 bg-[var(--color-navy-light)] p-4 sm:top-1/2 sm:max-w-lg sm:-translate-y-1/2 sm:p-6"
      >
        {result ? (
          <PraiseSuccess
            result={result}
            onClose={() => onOpenChange(false)}
            onOpenHall={() => {
              onOpenChange(false)
              onOpenHall()
            }}
          />
        ) : (
          <>
            <DialogHeader className="gap-1.5 pr-8">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]/80">
                <ScrollTextIcon className="size-3.5" aria-hidden />
                Royal scroll
              </p>
              <DialogTitle className="font-display text-xl leading-tight text-[var(--color-gold)]">
                {COPY.composerTitle}
              </DialogTitle>
              <DialogDescription className="text-xs leading-relaxed">
                {intro} One a day, {PRAISE_REWARD} points. He may crown the best one (+{ROYAL_FAVOR}).
              </DialogDescription>
            </DialogHeader>
            <PraiseComposer
              promptSeed={seed}
              knownFingerprints={knownFingerprints}
              pending={submit.isPending}
              error={error}
              textareaRef={textareaRef}
              onSubmit={handleSubmit}
              onChange={() => {
                if (error) setError(null)
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
