import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatTileProps {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon?: LucideIcon
  className?: string
  emphasis?: boolean
}

export function StatTile({ label, value, hint, icon: Icon, className, emphasis = false }: StatTileProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-xl border bg-card px-3 py-2.5 sm:px-4 sm:py-3",
        emphasis ? "border-[var(--color-gold)]/35 bg-[var(--color-gold)]/[0.04]" : "border-[var(--color-gold)]/15",
        className
      )}
    >
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {Icon ? <Icon className="size-3.5 shrink-0 text-[var(--color-gold)]/70" aria-hidden /> : null}
        <span className="truncate">{label}</span>
      </p>
      <div className="font-display text-xl leading-tight font-semibold text-[var(--color-gold-light)] sm:text-2xl">{value}</div>
      {hint ? <div className="line-clamp-2 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  )
}
