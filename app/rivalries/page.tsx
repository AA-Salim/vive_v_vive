import type { Metadata } from "next"
import { RivalriesView } from "@/components/pages/rivalries/rivalries-view"

export const metadata: Metadata = {
  title: "Rivalries | Vive v Vive Custom",
}

export default function RivalriesPage() {
  return <RivalriesView />
}
