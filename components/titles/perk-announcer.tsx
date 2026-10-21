"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useLive, useLiveSignal } from "@/components/live/live-provider"
import type { LiveEventPayloads } from "@/lib/live/events"
import { signed } from "@/lib/titles/copy"

const MAX_PERSONAL_TOASTS = 3

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`)

// Personal toasts for your own perks, tributes and brands (the live provider only narrates other people).
// Safe to mount more than once: toast ids dedupe.
export function TitlePerkAnnouncer() {
  const { userId } = useLive()
  const router = useRouter()

  useLiveSignal((signal) => {
    if (signal.kind !== "event" || !userId) return
    const { event } = signal

    if (event.type === "title.settled") {
      const { applications } = event.data as LiveEventPayloads["title.settled"]
      const mine = applications.filter((a) => a.userId === userId || a.beneficiaryId === userId)
      if (mine.length > MAX_PERSONAL_TOASTS) {
        const total = mine.reduce((sum, a) => sum + (a.userId === userId ? a.delta : -a.delta), 0)
        toast(`Your titles moved ${signed(total)} points`, {
          id: `titles-${event.id}`,
          description: `${mine.length} perks, curses and tributes settled this game.`,
        })
        return
      }
      mine.forEach((a, index) => {
        const id = `titles-${event.id}-${index}`
        if (a.userId === userId) {
          const line = `${a.title}: ${signed(a.delta)}`
          if (a.delta > 0) toast.success(line, { id, description: a.detail })
          else toast.error(line, { id, description: a.beneficiaryName ? `${sentence(a.detail)} Paid to ${a.beneficiaryName}.` : a.detail })
        } else {
          toast.success(`Tribute: ${signed(-a.delta)} from ${a.name}`, { id, description: `${a.title} keeps paying. ${sentence(a.detail)}` })
        }
      })
      return
    }

    if (event.type === "title.bestowed") {
      const data = event.data as LiveEventPayloads["title.bestowed"]
      if (data.targetUserId !== userId) return
      toast.error(`You have been branded: ${data.title}`, {
        id: `titles-${event.id}`,
        description: `${event.actor?.name ?? "Someone"} decreed it.${data.curse ? ` ${sentence(data.curse)}` : ""}`,
        duration: 10_000,
        action: { label: "See the brand", onClick: () => router.push("/titles") },
      })
    }
  })

  return null
}
