import { Suspense } from "react"
import type { Metadata } from "next"
import { HistoryView } from "@/components/pages/history/history-view"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Match History | Vive v Vive Custom",
}

function HistoryFallback() {
  return (
    <div className="mx-auto max-w-4xl space-y-3" aria-busy="true">
      <Skeleton className="h-20 w-full max-w-md" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-36 w-full rounded-2xl" />
      ))}
    </div>
  )
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<HistoryFallback />}>
      <HistoryView />
    </Suspense>
  )
}
