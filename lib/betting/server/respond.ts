import { NextResponse } from "next/server"
import { BET_ERRORS, betErrorCode, type BetErrorCode } from "@/lib/betting/errors"

export function betError(code: BetErrorCode, message?: string) {
  const entry = BET_ERRORS[code]
  return NextResponse.json({ error: message ?? entry.message, code }, { status: entry.status })
}

export function betErrorFromDb(error: { message?: string } | null | undefined, fallback = "The bookmaker spilled his ink. Try again.") {
  const code = betErrorCode(error?.message)
  if (code) return betError(code)
  return NextResponse.json({ error: fallback, code: "unknown" }, { status: 500 })
}
