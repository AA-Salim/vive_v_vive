import type { Metadata } from "next"
import { ChampionsView } from "@/components/pages/champions/champions-view"

export const metadata: Metadata = {
  title: "Champions | Vive v Vive Custom",
}

export default function ChampionsPage() {
  return <ChampionsView />
}
