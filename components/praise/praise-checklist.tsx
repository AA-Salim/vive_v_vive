import { CircleCheckIcon, CircleDashedIcon, CircleIcon, CircleXIcon } from "lucide-react"
import {
  PRAISE_MAX_CHARS,
  PRAISE_MIN_CHARS,
  PRAISE_MIN_WORDS,
  SALAXE_NAMES,
  type CheckState,
  type PraiseAnalysis,
  type PraiseCheck,
} from "@/lib/praise/rules"
import { cn } from "@/lib/utils"

const ITEMS: { key: PraiseCheck; label: string; hint: (analysis: PraiseAnalysis) => string }[] = [
  {
    key: "words",
    label: `${PRAISE_MIN_WORDS}+ words`,
    hint: (a) => `${Math.min(a.words, PRAISE_MIN_WORDS)}/${PRAISE_MIN_WORDS}`,
  },
  {
    key: "length",
    label: `${PRAISE_MIN_CHARS} to ${PRAISE_MAX_CHARS} characters`,
    hint: (a) => (a.chars > PRAISE_MAX_CHARS ? `${a.chars - PRAISE_MAX_CHARS} too many` : String(a.chars)),
  },
  { key: "name", label: "Names the King", hint: () => `${SALAXE_NAMES.slice(0, 3).join(", ")}...` },
  { key: "original", label: "Your own words", hint: (a) => (a.checks.original === "fail" ? "Copied" : "No prompt copying") },
  { key: "clean", label: "No mash, no spam", hint: (a) => (a.checks.clean === "fail" ? "Rewrite it" : "Real words only") },
]

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

export function PraiseChecklist({ id, analysis }: { id: string; analysis: PraiseAnalysis }) {
  return (
    <ul id={id} className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2" aria-label="Praise requirements">
      {ITEMS.map((item) => {
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
