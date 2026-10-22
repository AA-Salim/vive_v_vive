"use client"

import { useId, useMemo, useState, type RefObject } from "react"
import { FeatherIcon, Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PraiseChecklist } from "@/components/praise/praise-checklist"
import { BoostedAmount, TitleBonusChips, usePraiseTerms } from "@/components/praise/title-bonus"
import { WorshipChips } from "@/components/praise/worship-chips"
import { readDraft, writeDraft } from "@/lib/praise/draft"
import { analyzePraise, cleanPraise, countChars, PRAISE_INPUT_MAX, type PraiseRules } from "@/lib/praise/rules"
import { COPY, submitErrorMessage } from "@/lib/praise/voice"
import { cn } from "@/lib/utils"

interface PraiseComposerProps {
  promptSeed: number
  rules: PraiseRules
  // The base reward of the kiss being written, before title effects (rules.reward by default).
  reward?: number
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

// A short line goes in at the caret, with a space on each side where a word touches it.
function insertWord(text: string, word: string, start: number, end: number) {
  const before = text.slice(0, start)
  const after = text.slice(end)
  const lead = before && !/\s$/.test(before) ? " " : ""
  const trail = after && !/^\s/.test(after) ? " " : ""
  return { text: `${before}${lead}${word}${trail}${after}`, caret: before.length + lead.length + word.length + trail.length }
}

export function PraiseComposer({
  promptSeed,
  rules,
  reward,
  knownFingerprints,
  bonus = 0,
  pending,
  error,
  textareaRef,
  onSubmit,
  onChange,
}: PraiseComposerProps) {
  const [text, setText] = useState(readDraft)
  const terms = usePraiseTerms(reward ?? rules.reward)
  const analysis = useMemo(() => analyzePraise(text, knownFingerprints, rules), [text, knownFingerprints, rules])
  const textareaId = useId()
  const checklistId = useId()
  const hintId = useId()
  const errorId = useId()
  const short = rules.maxChars <= 60
  const over = analysis.chars > rules.maxChars
  const hint = !error && analysis.issue ? submitErrorMessage(analysis.issue, null, rules) : null
  const fill = Math.min(100, (analysis.chars / rules.maxChars) * 100)
  const room = rules.maxChars - analysis.chars - (analysis.chars > 0 ? 1 : 0)

  const update = (value: string) => {
    setText(value)
    writeDraft(value)
    onChange()
  }

  const submit = () => {
    if (analysis.ready && !pending) onSubmit(analysis.clean)
  }

  const pick = (word: string) => {
    const field = textareaRef.current
    const start = field?.selectionStart ?? text.length
    const end = field?.selectionEnd ?? text.length
    const next = insertWord(text, word, start, end)
    if (countChars(cleanPraise(next.text)) > rules.maxChars) return
    update(next.text)
    requestAnimationFrame(() => {
      field?.focus()
      field?.setSelectionRange(next.caret, next.caret)
    })
  }

  return (
    <div className="space-y-4">
      <WorshipChips seed={promptSeed} room={room} showNames={analysis.checks.name !== "ok"} onPick={pick} />

      <div className="relative mx-1 rounded-xl border border-[var(--color-gold)]/30 bg-gradient-to-b from-[var(--color-navy-lighter)] via-[var(--color-navy-light)] to-[var(--color-navy)] px-3 pt-4 pb-3 transition-[border-color,box-shadow] focus-within:border-[var(--color-gold)]/70 focus-within:ring-3 focus-within:ring-ring/30">
        <ScrollRod className="-top-1.5" />
        <label htmlFor={textareaId} className="sr-only">
          {COPY.scrollLabel}
        </label>
        <Textarea
          id={textareaId}
          ref={textareaRef}
          value={text}
          rows={short ? 2 : 5}
          maxLength={short ? rules.maxChars * 2 : PRAISE_INPUT_MAX}
          placeholder={COPY.placeholder}
          aria-describedby={error ? `${checklistId} ${errorId}` : `${checklistId} ${hintId}`}
          aria-invalid={error ? true : undefined}
          onChange={(event) => update(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey || (short && !event.shiftKey))) {
              event.preventDefault()
              submit()
            }
          }}
          className={cn(
            "resize-none border-0 bg-transparent px-1 py-1 font-serif text-base leading-relaxed italic shadow-none focus-visible:border-0 focus-visible:ring-0 md:text-base dark:bg-transparent",
            short ? "min-h-16" : "min-h-32"
          )}
        />
        <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px] text-muted-foreground">
          <span className="tabular-nums">
            {analysis.words} {analysis.words === 1 ? "word" : "words"}
          </span>
          <span className={cn("tabular-nums", over && "font-semibold text-destructive")}>
            {analysis.chars}/{rules.maxChars}
          </span>
        </div>
        <div className="relative mx-1 mt-1.5 mb-1 h-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className={cn(
              "h-full rounded-full transition-[width,background-color] duration-300",
              over ? "bg-destructive" : analysis.chars >= rules.minChars ? "bg-[var(--color-gold)]" : "bg-[var(--color-gold)]/40"
            )}
            style={{ width: `${fill}%` }}
          />
          <div
            className="absolute inset-y-0 w-px bg-foreground/40"
            style={{ left: `${(rules.minChars / rules.maxChars) * 100}%` }}
          />
        </div>
        <ScrollRod className="-bottom-1.5" />
      </div>

      <div>
        <PraiseChecklist id={checklistId} analysis={analysis} rules={rules} />
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
              <BoostedAmount
                value={terms.reward + bonus}
                base={terms.base + bonus}
                className="rounded-md bg-primary-foreground/15 px-1.5 py-0.5 text-sm tabular-nums"
              />
            </>
          )}
        </Button>
        <TitleBonusChips notes={terms.rewardNotes} capped={terms.rewardCapped} className="justify-center" />
        <p className="hidden text-center text-[11px] text-muted-foreground sm:block">{short ? COPY.shortcutShort : COPY.shortcut}</p>
      </div>
    </div>
  )
}
