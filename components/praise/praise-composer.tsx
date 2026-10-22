"use client"

import { useId, useMemo, useState, type RefObject } from "react"
import { FeatherIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { InspirationPrompt } from "@/components/praise/inspiration-prompt"
import { PraiseChecklist } from "@/components/praise/praise-checklist"
import { readDraft, writeDraft } from "@/lib/praise/draft"
import {
  analyzePraise,
  PRAISE_INPUT_MAX,
  PRAISE_MAX_CHARS,
  PRAISE_MIN_CHARS,
  PRAISE_REWARD,
} from "@/lib/praise/rules"
import { COPY, submitErrorMessage } from "@/lib/praise/voice"
import { cn } from "@/lib/utils"

interface PraiseComposerProps {
  promptSeed: number
  knownFingerprints: ReadonlySet<string>
  bonus?: number
  pending: boolean
  error: string | null
  textareaRef: RefObject<HTMLTextAreaElement | null>
  onSubmit: (body: string) => void
  onChange: () => void
}

function ScrollRod({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-3 h-2.5 rounded-full bg-gradient-to-r from-[var(--color-gold-dark)] via-[var(--color-gold)] to-[var(--color-gold-dark)] shadow-sm shadow-black/40",
        "before:absolute before:top-1/2 before:-left-1.5 before:size-3.5 before:-translate-y-1/2 before:rounded-full before:bg-[var(--color-gold-dark)] before:ring-1 before:ring-[var(--color-gold)]/60",
        "after:absolute after:top-1/2 after:-right-1.5 after:size-3.5 after:-translate-y-1/2 after:rounded-full after:bg-[var(--color-gold-dark)] after:ring-1 after:ring-[var(--color-gold)]/60",
        className
      )}
    />
  )
}

export function PraiseComposer({
  promptSeed,
  knownFingerprints,
  bonus = 0,
  pending,
  error,
  textareaRef,
  onSubmit,
  onChange,
}: PraiseComposerProps) {
  const [text, setText] = useState(readDraft)
  const analysis = useMemo(() => analyzePraise(text, knownFingerprints), [text, knownFingerprints])
  const textareaId = useId()
  const checklistId = useId()
  const hintId = useId()
  const errorId = useId()
  const over = analysis.chars > PRAISE_MAX_CHARS
  const hint = !error && analysis.issue ? submitErrorMessage(analysis.issue) : null
  const fill = Math.min(100, (analysis.chars / PRAISE_MAX_CHARS) * 100)

  const submit = () => {
    if (analysis.ready && !pending) onSubmit(analysis.clean)
  }

  return (
    <div className="space-y-4">
      <InspirationPrompt seed={promptSeed} paused={text.length > 0} />

      <div className="relative mx-1 rounded-xl border border-[var(--color-gold)]/30 bg-gradient-to-b from-[var(--color-navy-lighter)] via-[var(--color-navy-light)] to-[var(--color-navy)] px-3 pt-4 pb-3 transition-[border-color,box-shadow] focus-within:border-[var(--color-gold)]/70 focus-within:ring-3 focus-within:ring-ring/30">
        <ScrollRod className="-top-1.5" />
        <label htmlFor={textareaId} className="sr-only">
          {COPY.scrollLabel}
        </label>
        <Textarea
          id={textareaId}
          ref={textareaRef}
          value={text}
          rows={5}
          maxLength={PRAISE_INPUT_MAX}
          placeholder={COPY.placeholder}
          aria-describedby={error ? `${checklistId} ${errorId}` : `${checklistId} ${hintId}`}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            setText(event.target.value)
            writeDraft(event.target.value)
            onChange()
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              submit()
            }
          }}
          className="min-h-32 resize-none border-0 bg-transparent px-1 py-1 font-serif text-base leading-relaxed italic shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-base dark:bg-transparent"
        />
        <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground">
          <span className="tabular-nums">
            {analysis.words} {analysis.words === 1 ? "word" : "words"}
          </span>
          <span className={cn("tabular-nums", over && "font-semibold text-destructive")}>
            {analysis.chars}/{PRAISE_MAX_CHARS}
          </span>
        </div>
        <div className="relative mx-1 mt-1.5 mb-1 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className={cn(
              "h-full rounded-full transition-[width,background-color] duration-300",
              over ? "bg-destructive" : analysis.chars >= PRAISE_MIN_CHARS ? "bg-[var(--color-gold)]" : "bg-[var(--color-gold)]/40"
            )}
            style={{ width: `${fill}%` }}
          />
          <div
            className="absolute inset-y-0 w-px bg-foreground/40"
            style={{ left: `${(PRAISE_MIN_CHARS / PRAISE_MAX_CHARS) * 100}%` }}
          />
        </div>
        <ScrollRod className="-bottom-1.5" />
      </div>

      <div>
        <PraiseChecklist id={checklistId} analysis={analysis} />
        <p id={hintId} aria-live="polite" className={cn("text-xs leading-relaxed text-destructive", hint && "mt-2.5")}>
          {hint}
        </p>
      </div>

      {error && (
        <p id={errorId} role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-1.5">
        <Button
          type="button"
          onClick={submit}
          disabled={!analysis.ready || pending}
          className="h-12 w-full gap-2 text-base font-semibold shadow-lg shadow-primary/20"
        >
          {pending ? (
            <>
              <Loader2Icon className="animate-spin" aria-hidden />
              {COPY.singing}
            </>
          ) : (
            <>
              <FeatherIcon aria-hidden />
              {COPY.sing}
              <span className="rounded-md bg-primary-foreground/15 px-1.5 py-0.5 text-sm tabular-nums">
                +{PRAISE_REWARD + bonus}
              </span>
            </>
          )}
        </Button>
        <p className="hidden text-center text-[11px] text-muted-foreground sm:block">{COPY.shortcut}</p>
      </div>
    </div>
  )
}
