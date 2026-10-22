"use client"

import type { QueryClient } from "@tanstack/react-query"
import { pointsKey } from "@/hooks/use-points"

export class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null
  ) {
    super(message)
  }
}

async function parse<T>(res: Response, fallback: string): Promise<T> {
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const body = (data ?? {}) as { error?: unknown; code?: unknown }
    throw new RequestError(
      typeof body.error === "string" ? body.error : fallback,
      res.status,
      typeof body.code === "string" ? body.code : null
    )
  }
  return data as T
}

export async function getJson<T>(url: string, signal: AbortSignal | undefined, fallback: string): Promise<T> {
  const res = await fetch(url, { signal, cache: "no-store" })
  return parse<T>(res, fallback)
}

export async function postJson<T>(url: string, body: unknown, fallback: string): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return parse<T>(res, fallback)
}

export function isMigrationPending(error: unknown): boolean {
  return error instanceof RequestError && (error.code === "migration_pending" || error.status === 503)
}

// The shared ["points", userId] cache: the purse updates the moment the server confirms a spend.
export function setCachedBalance(queryClient: QueryClient, userId: string | null, balance: number | null) {
  if (!userId || typeof balance !== "number") return
  queryClient.setQueryData(pointsKey(userId), (old: unknown) =>
    old && typeof old === "object" ? { ...(old as Record<string, unknown>), balance } : old
  )
}
