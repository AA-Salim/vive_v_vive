import type { ReactNode } from "react"
import { TriangleAlertIcon } from "lucide-react"
import { Crest } from "@/components/ui/crest"
import { cn } from "@/lib/utils"

interface StatusScreenProps {
  eyebrow: string
  title: string
  children: ReactNode
  actions?: ReactNode
  footnote?: ReactNode
  tone?: "royal" | "danger"
  className?: string
}

// Full-page states (404, crashes): crest, proclamation, a way back.
export function StatusScreen({ eyebrow, title, children, actions, footnote, tone = "royal", className }: StatusScreenProps) {
  return (
    <section
      className={cn("relative mx-auto flex min-h-[60dvh] max-w-xl flex-col items-center justify-center px-2 py-12 text-center", className)}
      aria-labelledby="status-title"
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-6 left-1/2 size-72 -translate-x-1/2 rounded-full blur-3xl",
          tone === "danger" ? "bg-[var(--color-red-team)]/12" : "bg-[var(--color-gold)]/12"
        )}
      />
      <div className="relative">
        <Crest className="size-20 drop-shadow-[0_8px_24px_var(--color-obsidian)] sm:size-24" />
        {tone === "danger" && (
          <span
            aria-hidden
            className="absolute -right-1 -bottom-1 grid size-8 place-items-center rounded-full border border-[var(--color-red-team)]/50 bg-[var(--color-navy)] text-[var(--color-red-team)]"
          >
            <TriangleAlertIcon className="size-4" />
          </span>
        )}
      </div>
      <p
        className={cn(
          "type-eyebrow relative mt-6",
          tone === "danger" ? "text-[var(--color-red-team)]" : "text-[var(--color-gold)]"
        )}
      >
        {eyebrow}
      </p>
      <h1 id="status-title" className="type-title gilded relative mt-2">
        {title}
      </h1>
      <div className="gold-rule relative my-5 w-40" aria-hidden />
      <div className="type-body relative max-w-md text-muted-foreground">{children}</div>
      {actions && <div className="relative mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">{actions}</div>}
      {footnote && <p className="relative mt-6 text-xs text-muted-foreground/80">{footnote}</p>}
    </section>
  )
}
