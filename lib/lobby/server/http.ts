import { NextResponse } from "next/server"
import type { ZodError } from "zod"

const NO_STORE = { "cache-control": "no-store" }

export function ok(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, "x-server-time": new Date().toISOString() } })
}

export function fail(status: number, error: string, code?: string) {
  return NextResponse.json(code ? { error, code } : { error }, { status, headers: NO_STORE })
}

export function invalid(error: ZodError, fallback = "That request did not make sense.") {
  return fail(400, error.issues[0]?.message ?? fallback, "invalid")
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    return null
  }
}

export const AUTH_REQUIRED = () => fail(401, "Sign in with Discord first.", "auth_required")
export const ADMIN_ONLY = () => fail(403, "Only an admin can do that.", "forbidden")
