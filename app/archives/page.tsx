import type { Metadata } from "next"
import { ArchivesView } from "@/components/pages/archives/archives-view"

export const metadata: Metadata = {
  title: "The Royal Archives | Vive v Vive Custom",
}

export default function ArchivesPage() {
  return <ArchivesView />
}
