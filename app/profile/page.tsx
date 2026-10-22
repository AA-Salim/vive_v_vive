import { Suspense } from "react"
import type { Metadata } from "next"
import { ProfileView } from "@/components/pages/profile/profile-view"
import { PageFallback } from "@/components/pages/page-fallback"

export const metadata: Metadata = {
  title: "Your Court File | Vive v Vive Custom",
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <ProfileView />
    </Suspense>
  )
}
