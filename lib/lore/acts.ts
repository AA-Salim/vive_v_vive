import { ACT2_STORY } from "@/lib/act2/story"

export interface ActChapter {
  numeral: string
  title: string
  body: string
}

export interface ActStory {
  act: number
  kicker: string
  title: string
  chapters: ActChapter[]
  closing: string
  dismiss: string
}

const STORIES: Record<number, ActStory> = {
  2: ACT2_STORY,
}

export function storyForAct(actNumber: number | null | undefined): ActStory | null {
  return actNumber ? (STORIES[actNumber] ?? null) : null
}

export function actIntroSeenKey(actNumber: number): string {
  return `act-intro-seen-${actNumber}`
}

export const ACT_INTRO_CLOSED_EVENT = "vvv:act-intro-closed"
