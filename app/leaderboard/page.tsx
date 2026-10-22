import type { Metadata } from "next"
import { LeaderboardView } from "@/components/leaderboard-view"

export const metadata: Metadata = {
  title: "The Treasury | Vive v Vive Custom",
}

export default function LeaderboardPage() {
  return <LeaderboardView />
}
