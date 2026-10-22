import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-lg border border-input bg-[var(--color-navy)]/60 px-3 py-2.5 text-base leading-relaxed text-foreground shadow-[inset_0_1px_2px_0_var(--color-obsidian)] transition-[color,background-color,border-color,box-shadow] outline-none placeholder:text-muted-foreground/70 hover:border-[var(--color-gold)]/35 focus-visible:border-[var(--color-gold)]/70 focus-visible:bg-[var(--color-navy)]/80 focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive/70 aria-invalid:ring-3 aria-invalid:ring-destructive/25 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
