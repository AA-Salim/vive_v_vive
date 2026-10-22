import { Suspense } from "react"
import type { Metadata } from "next"
import { StatsView } from "@/components/pages/stats/stats-view"
import { PageFallback } from "@/components/pages/page-fallback"

export const metadata: Metadata = {
  title: "Player Stats | Vive v Vive Custom",
}

export default function StatsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <StatsView />
    </Suspense>
  )
}
