"use client"

import { useId, useRef, useState, type RefObject } from "react"
import { NotebookPenIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAct } from "@/hooks/use-act"
import { getActContent } from "@/lib/act-content"
import { BET_RULES } from "@/lib/betting/rules"
import { cn } from "@/lib/utils"

interface DebtPledgeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentBalance: number
  onConfirm: () => void
  cost?: number
  actionLabel?: string
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ")
}

function matchedPrefix(typed: string, phrase: string): number {
  const a = typed.toLowerCase().replace(/\s+/g, " ").trimStart()
  const b = phrase.toLowerCase()
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

interface PledgeBodyProps {
  inputRef: RefObject<HTMLInputElement | null>
  actNumber: number
  currentBalance: number
  cost?: number
  actionLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

function PledgeBody({ inputRef, actNumber, currentBalance, cost, actionLabel, onConfirm, onCancel }: PledgeBodyProps) {
  const inputId = useId()
  const [phrase] = useState(() => getActContent(actNumber).getRandomPhrase())
  const [typed, setTyped] = useState("")
  const matches = normalize(typed) === normalize(phrase)
  const prefix = matchedPrefix(typed, phrase)
  const typedLength = typed.replace(/\s+/g, " ").trimStart().length
  const wrong = typedLength > prefix
  const after = cost != null ? currentBalance - cost : null

  const submit = () => {
    if (!matches) return
    onConfirm()
  }

  return (
    <>
      <DialogHeader>
        <div className="mb-1 flex size-10 items-center justify-center rounded-full border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10">
          <NotebookPenIcon className="size-5 text-[var(--color-gold)]" aria-hidden />
        </div>
        <DialogTitle className="font-display text-xl text-[var(--color-gold)]">A Deal With the Exiled King</DialogTitle>
        <DialogDescription className="leading-relaxed">
          {currentBalance < 0
            ? `Your purse reads ${currentBalance}. From exile, Salaxe offers credit down to ${BET_RULES.debtFloor}. The price is your pride, typed out in full.`
            : `This ${actionLabel ?? "purchase"} drops your purse below zero. Salaxe will cover the difference, for a price.`}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <dl
          className={cn(
            "grid gap-2 rounded-lg border border-border bg-[var(--color-navy)]/60 p-3 text-center",
            after != null ? "grid-cols-3" : "grid-cols-2"
          )}
        >
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Purse</dt>
            <dd className={cn("font-display text-lg font-semibold tabular-nums", currentBalance < 0 ? "text-rose-300" : "text-[var(--color-gold-light)]")}>
              {currentBalance}
            </dd>
          </div>
          {after != null && (
            <div>
              <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">After</dt>
              <dd className={cn("font-display text-lg font-semibold tabular-nums", after < 0 ? "text-rose-300" : "text-[var(--color-gold-light)]")}>
                {after}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Floor</dt>
            <dd className="font-display text-lg font-semibold tabular-nums text-muted-foreground">{BET_RULES.debtFloor}</dd>
          </div>
        </dl>

        <div className="rounded-lg border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/5 p-4 text-center">
          <div className="mb-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Swear it, word for word</div>
          <p className="sr-only">{phrase}</p>
          <p aria-hidden className="font-display text-lg font-semibold leading-snug">
            <span className="text-[var(--color-gold)]">{phrase.slice(0, prefix)}</span>
            <span className={cn(wrong ? "text-rose-300 underline decoration-wavy" : "text-[var(--color-gold-light)]/45")}>
              {phrase.slice(prefix)}
            </span>
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor={inputId} className="sr-only">
            Type the pledge
          </label>
          <Input
            id={inputId}
            ref={inputRef}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                submit()
              }
            }}
            placeholder="Type the pledge..."
            aria-invalid={wrong || undefined}
            aria-describedby={`${inputId}-hint`}
            className="h-11 bg-[var(--color-navy)]/70 text-center"
          />
          <p id={`${inputId}-hint`} className={cn("text-center text-xs", wrong ? "text-rose-300" : "text-muted-foreground")} aria-live="polite">
            {matches ? "The ink is dry. Seal it." : wrong ? "That is not what he said. Exactly as written." : "Every point is written in his little notebook. He will collect."}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} className="h-10">
          Walk away
        </Button>
        <Button
          onClick={submit}
          disabled={!matches}
          className="h-10 bg-[var(--color-gold)] font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]"
        >
          Seal the pact
        </Button>
      </DialogFooter>
    </>
  )
}

export function DebtPledgeDialog({ open, onOpenChange, currentBalance, onConfirm, cost, actionLabel }: DebtPledgeDialogProps) {
  const { act } = useAct()
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent initialFocus={inputRef} className="border border-[var(--color-gold)]/25 sm:max-w-md">
        <PledgeBody
          inputRef={inputRef}
          actNumber={act?.act_number ?? 2}
          currentBalance={currentBalance}
          cost={cost}
          actionLabel={actionLabel}
          onCancel={() => onOpenChange(false)}
          onConfirm={() => {
            onConfirm()
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
