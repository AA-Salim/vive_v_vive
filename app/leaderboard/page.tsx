import { Suspense } from "react"
import type { Metadata } from "next"
import { LeaderboardView } from "@/components/leaderboard-view"
import { PageFallback } from "@/components/pages/page-fallback"

export const metadata: Metadata = {
  title: "The Treasury | Vive v Vive Custom",
}

export default function LeaderboardPage() {
  return (
    <Suspense fallback={<PageFallback className="max-w-5xl" />}>
      <LeaderboardView />
    </Suspense>
  )
}
