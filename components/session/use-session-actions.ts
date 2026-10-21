"use client"

import { useMutation, useMutationState, useQueryClient, type QueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { ACTIVE_SESSION_KEY } from "@/components/live/live-provider"
import type { RoomSession, SessionAction, SessionActionName } from "@/lib/session/types"

export class SessionApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string
  ) {
    super(message)
  }
}

interface ActiveSessionCache {
  session: RoomSession | null
  serverTimeDelta: number
}

async function request(url: string, init: RequestInit): Promise<RoomSession> {
  const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } })
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const message = typeof body?.error === "string" ? body.error : "Something went wrong. Try again."
    throw new SessionApiError(res.status, message, typeof body?.code === "string" ? body.code : undefined)
  }
  return body as RoomSession
}

export async function writeSession(queryClient: QueryClient, session: RoomSession) {
  await queryClient.cancelQueries({ queryKey: ACTIVE_SESSION_KEY })
  queryClient.setQueryData<ActiveSessionCache>(ACTIVE_SESSION_KEY, (prev) => ({
    serverTimeDelta: prev?.serverTimeDelta ?? 0,
    session,
  }))
}

export function reportSessionError(error: unknown, onSignIn?: () => void) {
  if (error instanceof SessionApiError) {
    if (error.status === 401) {
      toast.error(error.message, onSignIn ? { action: { label: "Sign in", onClick: onSignIn } } : undefined)
      return
    }
    if (error.status === 409) {
      toast(error.message)
      return
    }
    toast.error(error.message)
    return
  }
  toast.error("The connection dropped. Try again.")
}

const LOCK_KEY = ["session", "lock"] as const

export function useSessionActions(session: RoomSession, onSignIn?: () => void) {
  const queryClient = useQueryClient()
  const action = useMutation({
    mutationKey: ["session", "action", session.id],
    mutationFn: (input: Exclude<SessionAction, { action: "toggle_lock" }>) =>
      request(`/api/sessions/${session.id}`, { method: "PATCH", body: JSON.stringify(input) }),
    onSuccess: (next) => writeSession(queryClient, next),
    onError: (error) => reportSessionError(error, onSignIn),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["session"] }),
  })

  return {
    runAsync: action.mutateAsync,
    pending: (action.isPending ? action.variables?.action ?? null : null) as SessionActionName | null,
  }
}

export function useLockToggle(session: RoomSession, onSignIn?: () => void) {
  const queryClient = useQueryClient()
  const lock = useMutation({
    mutationKey: LOCK_KEY,
    mutationFn: (assignmentId: string) =>
      request(`/api/sessions/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "toggle_lock", assignment_id: assignmentId }),
      }),
    onMutate: async (assignmentId) => {
      await queryClient.cancelQueries({ queryKey: ACTIVE_SESSION_KEY })
      const previous = queryClient.getQueryData<ActiveSessionCache>(ACTIVE_SESSION_KEY)
      if (previous?.session?.id === session.id) {
        queryClient.setQueryData<ActiveSessionCache>(ACTIVE_SESSION_KEY, {
          ...previous,
          session: {
            ...previous.session,
            session_assignments: previous.session.session_assignments.map((a) =>
              a.id === assignmentId ? { ...a, locked: !a.locked } : a
            ),
          },
        })
      }
      return { previous }
    },
    onSuccess: (next) => writeSession(queryClient, next),
    onError: (error, _id, context) => {
      if (context?.previous) queryClient.setQueryData(ACTIVE_SESSION_KEY, context.previous)
      reportSessionError(error, onSignIn)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["session"] }),
  })

  const pending = useMutationState({
    filters: { mutationKey: LOCK_KEY, status: "pending" },
    select: (m) => m.state.variables as string,
  })

  return { toggleLock: lock.mutate, pendingLocks: new Set(pending) }
}

export function useCreateSession(onSignIn?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ["session", "create"],
    mutationFn: (playerIds: string[]) =>
      request("/api/sessions", { method: "POST", body: JSON.stringify({ player_ids: playerIds }) }),
    onSuccess: (next) => writeSession(queryClient, next),
    onError: (error) => {
      if (error instanceof SessionApiError && error.code === "active_session") {
        toast("A game is already running. Joining it now.")
        return
      }
      reportSessionError(error, onSignIn)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["session"] }),
  })
}

export function useStartCoachDraft(onSignIn?: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ["session", "coach-draft"],
    mutationFn: ({ blue, red }: { blue: string; red: string }) =>
      request("/api/sessions/coach-draft", {
        method: "POST",
        body: JSON.stringify({ blue_coach_id: blue, red_coach_id: red }),
      }),
    onSuccess: (next) => writeSession(queryClient, next),
    onError: (error) => reportSessionError(error, onSignIn),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["session"] }),
  })
}
