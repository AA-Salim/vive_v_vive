"use client"

import { useLive } from "@/components/live/live-provider"
import { narrate } from "@/lib/live/narration"

interface ActivityFeedProps {
  sessionId: string | null
  limit?: number
}

export function ActivityFeed({ sessionId, limit = 12 }: ActivityFeedProps) {
  const { feed } = useLive()
  const items = feed
    .filter((e) => !sessionId || !e.sessionId || e.sessionId === sessionId)
    .map((e) => ({ event: e, line: narrate(e) }))
    .filter((x) => x.line)
    .slice(0, limit)

  if (items.length === 0) return null

  return (
    <div className="rounded-lg border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)] p-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--color-gold)]">Live</div>
      <ul className="space-y-1.5">
        {items.map(({ event, line }) => (
          <li key={event.id} className="text-xs text-[var(--color-gold-light)]/80">
            {line!.title}
          </li>
        ))}
      </ul>
    </div>
  )
}
