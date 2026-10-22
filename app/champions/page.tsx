import { Suspense } from "react"
import type { Metadata } from "next"
import { ChampionsView } from "@/components/pages/champions/champions-view"
import { PageFallback } from "@/components/pages/page-fallback"

export const metadata: Metadata = {
  title: "Champions | Vive v Vive Custom",
}

export default function ChampionsPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ChampionsView />
    </Suspense>
  )
}
