import type { Metadata } from "next"
import { StatsView } from "@/components/pages/stats/stats-view"

export const metadata: Metadata = {
  title: "Player Stats | Vive v Vive Custom",
}

export default function StatsPage() {
  return <StatsView />
}
