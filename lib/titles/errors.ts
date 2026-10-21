import { NextResponse } from "next/server"

interface TitleError {
  status: number
  message: string
}

const TITLE_ERRORS: Record<string, TitleError> = {
  not_authenticated: { status: 401, message: "Sign in to deal in titles." },
  title_not_found: { status: 404, message: "That title does not exist. Not even in Salaxe's little notebook." },
  not_for_sale: { status: 400, message: "Honors are earned on the Rift, not bought at the counter." },
  target_required: { status: 400, message: "Pick a victim first." },
  self_target: { status: 400, message: "You cannot curse yourself. Ask a friend: they will gladly do it." },
  target_not_found: { status: 404, message: "That subject is not part of the court." },
  already_owned: { status: 409, message: "Already owned. Hoarding the same title twice is a Salaxe move." },
  already_branded: { status: 409, message: "They already bear that brand. Let it burn a little longer." },
  curse_limit: { status: 409, message: "They already carry two brands. Even the court has limits." },
  titles_locked: { status: 409, message: "The game is live. Titles are sealed until a winner is declared." },
  not_owned: { status: 403, message: "That title is not yours to wear." },
  not_cursed: { status: 404, message: "No such brand on you. Your dignity is intact, for now." },
  debt_limit: { status: 400, message: "The treasury refuses: that would sink you past the -300 debt limit." },
  insufficient: { status: 400, message: "Not enough points for that." },
}

const FALLBACK: TitleError = { status: 500, message: "The royal scribes dropped the scroll. Try again." }

export function titleErrorKey(error: { code?: string; message?: string } | null | undefined): string | null {
  if (!error) return null
  const message = error.message ?? ""
  if (message in TITLE_ERRORS) return message
  if (/debt limit|min_balance/i.test(message)) return "debt_limit"
  if (/insufficient/i.test(message)) return "insufficient"
  if (error.code === "23505") return "already_owned"
  return null
}

export function titleError(key: string | null, extra?: Record<string, unknown>) {
  const entry = (key && TITLE_ERRORS[key]) || FALLBACK
  return NextResponse.json({ error: entry.message, code: key ?? "unknown", ...extra }, { status: entry.status })
}
