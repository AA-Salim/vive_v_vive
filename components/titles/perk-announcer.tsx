"use client"

import { toast } from "sonner"
import { useLive, useLiveSignal } from "@/components/live/live-provider"
import type { LiveEventPayloads } from "@/lib/live/events"
import { signed } from "@/lib/titles/copy"

const MAX_PERSONAL_TOASTS = 3

const sentence = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`)

// Personal toasts for your own perk payouts and the tributes you collect: the live provider never narrates
// your own events, and title.settled carries no narration. Brands bestowed on you arrive as personal live
// alerts (title.bestowed with targetUserId). Safe to mount more than once: toast ids dedupe.
export function TitlePerkAnnouncer() {
  const { userId } = useLive()

  useLiveSignal((signal) => {
    if (signal.kind !== "event" || !userId || signal.event.type !== "title.settled") return
    const { event } = signal
    const { applications } = event.data as LiveEventPayloads["title.settled"]
    const mine = applications.filter((a) => a.userId === userId || a.beneficiaryId === userId)
    if (mine.length === 0) return

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
  })

  return null
}
