import type { Metadata } from "next"
import { DuosView } from "@/components/pages/duos/duos-view"

export const metadata: Metadata = {
  title: "Duos | Vive v Vive Custom",
}

export default function DuosPage() {
  return <DuosView />
}
