// The tones live toasts and the feed know how to style; anything new from the narration falls back to "info".
export type LiveTone = "info" | "hype" | "royal" | "roast" | "danger"

const LIVE_TONES: readonly string[] = ["info", "hype", "royal", "roast", "danger"]

export function liveTone(tone: string | null | undefined): LiveTone {
  return tone && LIVE_TONES.includes(tone) ? (tone as LiveTone) : "info"
}

export const TONE_RANK: readonly LiveTone[] = ["danger", "royal", "hype", "roast", "info"]
