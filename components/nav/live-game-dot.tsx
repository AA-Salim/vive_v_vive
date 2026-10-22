import { cn } from "@/lib/utils"

export function LiveGameDot({
  label,
  showLabel = false,
  className,
}: {
  label: string | null
  showLabel?: boolean
  className?: string
}) {
  const spoken = `Game in progress${label ? `: ${label}` : ""}`
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={spoken}>
      <span className="relative inline-flex size-2 shrink-0" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-[var(--color-red-team)] opacity-70 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-[var(--color-red-team)] shadow-[0_0_8px_var(--color-red-team)]" />
      </span>
      {showLabel && label ? (
        <span className="rounded-full border border-[var(--color-red-team)]/35 bg-[var(--color-red-team)]/12 px-1.5 text-[10px] leading-4 font-semibold tracking-[0.12em] text-[var(--color-gold-light)] uppercase">
          <span className="sr-only">Game in progress: </span>
          {label}
        </span>
      ) : (
        <span className="sr-only">{spoken}</span>
      )}
    </span>
  )
}
