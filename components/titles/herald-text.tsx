"use client"

import { ProfileTrigger } from "@/components/profile/profile-provider"
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
// Interactive lines (the activity feed) make the actor's name open their profile.
export function HeraldText({ text, actor, interactive = false }: HeraldTextProps) {
  const { byUserId } = useEquippedTitles()
  const entry = actor?.userId ? byUserId.get(actor.userId) : undefined
  const name = actor ? display(actor.name) : null
  const split = name && (entry || interactive) ? splitOnName(text, name) : null
  if (!split) return <>{text}</>

  const banner = entry ? bannerOf(entry) : null
  const shown = entry ? (
    <PlayerName name={split.match} title={entry} epithet={!!banner && !text.includes(banner.title)} inline />
  ) : (
    split.match
  )
  return (
    <>
      {split.before}
      {interactive ? (
        <ProfileTrigger playerId={entry?.playerId} name={split.match} className="inline">
          {shown}
        </ProfileTrigger>
      ) : (
        shown
      )}
      {split.after}
    </>
  )
}
