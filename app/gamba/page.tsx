import { Suspense } from "react"
import type { Metadata } from "next"
import { GamblingHall } from "@/components/betting/hall/gambling-hall"
import { PageFallback } from "@/components/pages/page-fallback"

export const metadata: Metadata = {
  title: "The Gambling Hall | Vive v Vive Custom",
}

export default function GambaPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <GamblingHall />
    </Suspense>
  )
}
