import type { Metadata } from "next"
import { PlayersView } from "@/components/pages/players/players-view"

export const metadata: Metadata = {
  title: "Players | Vive v Vive Custom",
}

export default function PlayersPage() {
  return <PlayersView />
}
