"use client"

import { RotateCcwIcon, ScrollTextIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export function RoomSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading the match room">
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>
        <Skeleton className="mt-5 h-9 w-56" />
        <Skeleton className="mt-3 h-4 w-full max-w-md" />
        <Skeleton className="mt-6 h-11 w-40" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {Array.from({ length: 2 }, (_, col) => (
          <div key={col} className="flex flex-col gap-2">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-[84px] w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function RoomError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center">
      <ScrollTextIcon className="size-8 text-[var(--color-gold)]" aria-hidden />
      <h1 className="font-display text-2xl text-foreground">The royal scribes lost the scroll</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        The match room could not be loaded. Your points are safe; the connection is not.
      </p>
      <Button className="h-11 px-5" onClick={onRetry}>
        <RotateCcwIcon aria-hidden />
        Try again
      </Button>
    </div>
  )
}
