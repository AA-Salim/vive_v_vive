"use client"

import { LogInIcon, NotebookPenIcon, RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MARKET_COPY } from "@/lib/betting/copy"

export const PANEL_CLASS =
  "relative overflow-hidden rounded-2xl border border-[var(--color-gold)]/25 bg-card p-4 shadow-[0_18px_48px_-28px_var(--color-gold)] sm:p-5"

export function MarketSkeleton() {
  return (
    <section className={PANEL_CLASS} aria-busy="true" aria-label="Loading wagers">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3 w-56 max-w-full" />
        </div>
        <Skeleton className="h-8 w-20 rounded-full" />
      </div>
      <div className="mt-5 grid grid-cols-3 items-end gap-3">
        <Skeleton className="h-14" />
        <Skeleton className="mx-auto h-10 w-16" />
        <Skeleton className="h-14" />
      </div>
      <Skeleton className="mt-3 h-2.5 w-full rounded-full" />
      <div className="mt-5 grid grid-cols-2 gap-2">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
      <Skeleton className="mt-3 h-12 w-full rounded-xl" />
      <Skeleton className="mt-3 h-12 w-full rounded-xl" />
    </section>
  )
}

export function MarketError({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <section className={PANEL_CLASS} role="alert">
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <NotebookPenIcon className="size-8 text-[var(--color-gold)]/70" aria-hidden />
        <div>
          <p className="font-display text-base font-semibold text-[var(--color-gold)]">The bookmaker lost his notebook</p>
          <p className="text-xs text-muted-foreground">Wagers could not be loaded. Your points are safe.</p>
        </div>
        <Button variant="outline" onClick={onRetry} disabled={retrying} className="h-10">
          <RefreshCwIcon className={retrying ? "size-4 animate-spin" : "size-4"} aria-hidden />
          Try again
        </Button>
      </div>
    </section>
  )
}

export function LoginCta({ onSignIn, loading }: { onSignIn: () => void; loading: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-gold)]/30 px-4 py-6 text-center">
      <p className="text-sm text-[var(--color-gold-light)]/85">{MARKET_COPY.loginHint}</p>
      <Button
        onClick={onSignIn}
        disabled={loading}
        className="h-11 rounded-xl bg-[var(--color-gold)] px-5 font-semibold text-[var(--color-navy)] hover:bg-[var(--color-gold-light)]"
      >
        <LogInIcon className="size-4" aria-hidden />
        {MARKET_COPY.loginCta}
      </Button>
    </div>
  )
}
