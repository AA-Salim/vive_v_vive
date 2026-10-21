"use client"

import { useQuery } from "@tanstack/react-query"
import type { CoachDraftPickView, CoachProfile, QueueEntryView, RosterPlayer, VainqueurView } from "@/lib/lobby/types"

export const ROSTER_KEY = ["sessions", "players"] as const
export const PROFILES_KEY = ["sessions", "profiles"] as const
export const QUEUE_KEY = ["queue"] as const
export const VAINQUEUR_KEY = ["vainqueur"] as const

export function coachDraftKey(sessionId: string) {
  return ["coachdraft", sessionId] as const
}

export class LobbyApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string
  ) {
    super(message)
  }
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message = typeof body?.error === "string" ? body.error : "The connection dropped. Try again."
    throw new LobbyApiError(res.status, message, typeof body?.code === "string" ? body.code : undefined)
  }
  return body as T
}

export async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  return parse<T>(await fetch(url, { signal, cache: "no-store" }))
}

export async function sendJson<T>(url: string, body: unknown, method: "POST" | "PATCH" | "DELETE" = "POST"): Promise<T> {
  return parse<T>(
    await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  )
}

export function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "The connection dropped. Try again."
}

const asArray = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

export function useRoster() {
  return useQuery({
    queryKey: ROSTER_KEY,
    queryFn: async ({ signal }) => asArray<RosterPlayer>(await getJson<unknown>("/api/players", signal)),
    staleTime: 30_000,
  })
}

export function useQueue() {
  return useQuery({
    queryKey: QUEUE_KEY,
    queryFn: async ({ signal }) => asArray<QueueEntryView>(await getJson<unknown>("/api/queue", signal)),
    staleTime: 10_000,
  })
}

export function useVainqueur() {
  return useQuery({
    queryKey: VAINQUEUR_KEY,
    queryFn: ({ signal }) => getJson<VainqueurView>("/api/vainqueur", signal),
    staleTime: 10_000,
  })
}

export function useCoachProfiles(enabled: boolean) {
  return useQuery({
    queryKey: PROFILES_KEY,
    queryFn: async ({ signal }) => asArray<CoachProfile>(await getJson<unknown>("/api/auth/profiles", signal)),
    staleTime: 5 * 60_000,
    enabled,
  })
}

export function useCoachPicks(sessionId: string) {
  return useQuery({
    queryKey: coachDraftKey(sessionId),
    queryFn: async ({ signal }) => asArray<CoachDraftPickView>(await getJson<unknown>(`/api/sessions/${sessionId}/coach-draft`, signal)),
    staleTime: 5_000,
  })
}
