import type { Metadata } from "next"
import { ArchiveDetailView } from "@/components/pages/archives/archive-detail-view"

export const metadata: Metadata = {
  title: "Act Chronicle | Vive v Vive Custom",
}

export default async function ArchiveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ArchiveDetailView id={Number(id)} />
}
