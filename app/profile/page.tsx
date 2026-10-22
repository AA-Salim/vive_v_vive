import type { Metadata } from "next"
import { ProfileView } from "@/components/pages/profile/profile-view"

export const metadata: Metadata = {
  title: "Your Court File | Vive v Vive Custom",
}

export default function ProfilePage() {
  return <ProfileView />
}
