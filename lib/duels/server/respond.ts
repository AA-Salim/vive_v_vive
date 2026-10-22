import { NextResponse } from "next/server"
import { migrationPending, isMissingSchema } from "@/lib/db-errors"
import { DUEL_ERRORS, duelErrorCode, type DuelErrorCode } from "@/lib/duels/errors"
import { DUEL_FEATURE } from "@/lib/duels/rules"

export const NO_STORE = { "cache-control": "no-store" }

export function duelError(code: DuelErrorCode, message?: string) {
  const entry = DUEL_ERRORS[code]
  return NextResponse.json({ error: message ?? entry.message, code }, { status: entry.status, headers: NO_STORE })
}

export function duelErrorFromDb(
  error: { code?: string; message?: string } | null | undefined,
  fallback = "The herald dropped the gauntlet. Try again."
) {
  if (isMissingSchema(error)) return migrationPending(DUEL_FEATURE)
  const code = duelErrorCode(error?.message)
  if (code) return duelError(code)
  return NextResponse.json({ error: fallback, code: "unknown" }, { status: 500, headers: NO_STORE })
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}
