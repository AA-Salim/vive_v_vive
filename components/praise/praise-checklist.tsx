import { CircleCheckIcon, CircleDashedIcon, CircleIcon, CircleXIcon } from "lucide-react"
import {
  SALAXE_NAMES,
  type CheckState,
  type PraiseAnalysis,
  type PraiseCheck,
  type PraiseRules,
} from "@/lib/praise/rules"
import { cn } from "@/lib/utils"

type Item = { key: PraiseCheck; label: string; hint: (analysis: PraiseAnalysis) => string }

function items(rules: PraiseRules): Item[] {
  return [
    {
      key: "length",
      label: `${rules.minChars} to ${rules.maxChars} characters`,
      hint: (a) => (a.chars > rules.maxChars ? `${a.chars - rules.maxChars} too many` : String(a.chars)),
    },
    {
      key: "words",
      label: `${rules.minWords}+ words`,
      hint: (a) => `${Math.min(a.words, rules.minWords)}/${rules.minWords}`,
    },
    { key: "name", label: "Names the King", hint: () => `${SALAXE_NAMES.slice(0, 3).join(", ")}...` },
    { key: "respect", label: "Praise, not poison", hint: (a) => (a.checks.respect === "fail" ? "He heard that" : "No insults") },
    { key: "original", label: "Never sung before", hint: (a) => (a.checks.original === "fail" ? "Already in the Hall" : "Your own line") },
    { key: "clean", label: "No mash, no spam", hint: (a) => (a.checks.clean === "fail" ? "Rewrite it" : "Real words only") },
  ]
}

const STATUS_TEXT: Record<CheckState, string> = {
  idle: "not started",
  progress: "not yet",
  ok: "done",
  fail: "needs a fix",
}

function StatusIcon({ state }: { state: CheckState }) {
  const className = "size-4 shrink-0"
  if (state === "ok") return <CircleCheckIcon className={cn(className, "text-[var(--color-gold)]")} aria-hidden />
  if (state === "fail") return <CircleXIcon className={cn(className, "text-destructive")} aria-hidden />
  if (state === "progress") return <CircleDashedIcon className={cn(className, "text-muted-foreground")} aria-hidden />
  return <CircleIcon className={cn(className, "text-muted-foreground/50")} aria-hidden />
}

export function PraiseChecklist({ id, analysis, rules }: { id: string; analysis: PraiseAnalysis; rules: PraiseRules }) {
  return (
    <ul id={id} className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2" aria-label="Praise requirements">
      {items(rules).map((item) => {
        const state = analysis.checks[item.key]
        return (
          <li
            key={item.key}
            className="flex min-w-0 items-center gap-2 text-xs"
            title={item.key === "name" ? `Any of: ${SALAXE_NAMES.join(", ")}` : undefined}
          >
            <StatusIcon state={state} />
            <span
              className={cn(
                "shrink-0",
                state === "ok" && "text-foreground",
                state === "fail" && "text-destructive",
                (state === "idle" || state === "progress") && "text-muted-foreground"
              )}
            >
              {item.label}
            </span>
            <span className="sr-only">: {STATUS_TEXT[state]}</span>
            <span className="ml-auto min-w-0 truncate text-[11px] tabular-nums text-muted-foreground/80">
              {item.hint(analysis)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
