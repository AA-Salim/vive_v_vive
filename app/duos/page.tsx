import { Suspense } from "react"
import type { Metadata } from "next"
import { DuosView } from "@/components/pages/duos/duos-view"
import { PageFallback } from "@/components/pages/page-fallback"

export const metadata: Metadata = {
  title: "Duos | Vive v Vive Custom",
}

export default function DuosPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <DuosView />
    </Suspense>
  )
}
