import type { Metadata } from "next"
import { GamblingHall } from "@/components/betting/hall/gambling-hall"

export const metadata: Metadata = {
  title: "The Gambling Hall | Vive v Vive Custom",
}

export default function GambaPage() {
  return <GamblingHall />
}
