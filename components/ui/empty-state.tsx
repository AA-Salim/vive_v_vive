import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  tone?: "default" | "danger"
  className?: string
}

function EmptyState({ icon: Icon, title, description, action, tone = "default", className }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed px-5 py-8 text-center",
        tone === "danger" ? "border-[var(--color-danger)]/35" : "border-[var(--color-gold)]/22",
        className
      )}
    >
      {Icon && (
        <span
          className={cn(
            "mb-1 grid size-11 place-items-center rounded-full border bg-[var(--color-navy)]/70",
            tone === "danger"
              ? "border-[var(--color-danger)]/40 text-[var(--color-danger)]"
              : "border-[var(--color-gold)]/30 text-[var(--color-gold)]"
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <p className="type-subheading text-[var(--color-gold-light)]">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export { EmptyState }
