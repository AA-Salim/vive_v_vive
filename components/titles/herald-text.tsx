"use client"

import { PlayerName } from "@/components/titles/player-name"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import type { LiveActor } from "@/lib/live/events"
import { display } from "@/lib/lore/herald/kit"
import { bannerOf, splitOnName } from "@/lib/titles/flair"

interface HeraldTextProps {
  text: string
  actor?: LiveActor | null
  interactive?: boolean
}

// Every herald line goes through here: a titled actor is named with their flair and epithet
// ("laefo the Kingslayer bet 100 on Blue"), whatever the event, from the shared equipped-titles cache.
export function HeraldText({ text, actor, interactive = false }: HeraldTextProps) {
  const { byUserId } = useEquippedTitles()
  const entry = actor?.userId ? byUserId.get(actor.userId) : undefined
  const name = actor ? display(actor.name) : null
  const split = entry && name ? splitOnName(text, name) : null
  if (!entry || !split) return <>{text}</>

  const banner = bannerOf(entry)
  return (
    <>
      {split.before}
      <PlayerName
        name={split.match}
        title={entry}
        epithet={!!banner && !text.includes(banner.title)}
        interactive={interactive}
        inline
      />
      {split.after}
    </>
  )
}
