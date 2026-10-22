"use client"

import { useCallback, useEffect, useState } from "react"
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query"
import { toast } from "sonner"
import { useLiveSignal } from "@/components/live/live-provider"
import { ACTIVE_SESSION_KEY, ACTIVE_STATUSES, type LiveEventPayloads } from "@/lib/live/events"
import { createClient } from "@/lib/supabase-client"
import { writeDraft } from "@/lib/praise/draft"
import { ROYAL_FAVOR } from "@/lib/praise/rules"
import type {
  HallPage,
  HallView,
  JudgeErrorCode,
  JudgeResult,
  PraiseState,
  PraiseVerdict,
  PraiseView,
  RiddleAnswer,
  RiddleErrorCode,
  RiddleSolveResult,
  RiddleState,
  SubmitErrorCode,
  SubmitResult,
} from "@/lib/praise/types"
import { judgeErrorMessage, riddleErrorMessage, submitErrorMessage } from "@/lib/praise/voice"
import type { SessionWithAssignments } from "@/lib/types"

export class PraiseRequestError<Code extends string = string> extends Error {
  code: Code
  status: number

  constructor(message: string, code: Code, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

export interface PraiseStateData {
  state: PraiseState
  clockOffset: number
}

export const praiseKeys = {
  all: ["praise"] as const,
  state: (userId: string | null) => ["praise", "state", userId ?? "anon"] as const,
  hall: (view: HallView, limit: number, userId: string | null) =>
    ["praise", "hall", view, limit, userId ?? "anon"] as const,
  riddle: (userId: string | null) => ["praise", "riddle", userId ?? "anon"] as const,
}

function invalidateEconomy(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: praiseKeys.all })
  queryClient.invalidateQueries({ queryKey: ["points"] })
  queryClient.invalidateQueries({ queryKey: ["leaderboard"] })
}

export function usePraiseAuth() {
  const [auth, setAuth] = useState<{ ready: boolean; userId: string | null }>({ ready: false, userId: null })

  useEffect(() => {
    const supabase = createClient()
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (active) setAuth({ ready: true, userId: data.session?.user.id ?? null })
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuth({ ready: true, userId: session?.user.id ?? null })
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async () => {
    await createClient().auth.signInWithOAuth({
      provider: "discord",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }, [])

  return { ...auth, signIn }
}

async function fetchPraiseState(): Promise<PraiseStateData> {
  const res = await fetch("/api/praise/state", { cache: "no-store" })
  if (!res.ok) throw new PraiseRequestError(`Praise state failed with ${res.status}`, "unknown", res.status)
  const state = (await res.json()) as PraiseState
  return { state, clockOffset: state.available ? Date.now() - Date.parse(state.serverNow) : 0 }
}

export function usePraiseState(userId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: praiseKeys.state(userId),
    queryFn: fetchPraiseState,
    enabled,
    staleTime: 15_000,
  })
}

export function usePraiseHall(view: HallView, limit: number, userId: string | null) {
  return useQuery({
    queryKey: praiseKeys.hall(view, limit, userId),
    queryFn: async (): Promise<HallPage> => {
      const res = await fetch(`/api/praise?view=${view}&limit=${limit}`, { cache: "no-store" })
      if (!res.ok) throw new PraiseRequestError(`Hall of Praise failed with ${res.status}`, "unknown", res.status)
      return res.json()
    },
    staleTime: 15_000,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[2] === view ? keepPreviousData(previous) : undefined,
  })
}

async function postJson<T>(url: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; status: number; error?: string; code?: string }> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => null)
    if (res.ok) return { ok: true, data: json as T }
    return { ok: false, status: res.status, error: json?.error, code: json?.code }
  } catch {
    return { ok: false, status: 0 }
  }
}

export function useSubmitPraise(userId: string | null) {
  const queryClient = useQueryClient()
  return useMutation<SubmitResult, PraiseRequestError<SubmitErrorCode>, string>({
    mutationFn: async (body) => {
      const result = await postJson<SubmitResult>("/api/praise", { body })
      if (result.ok) return result.data
      const code = (result.code ?? "unknown") as SubmitErrorCode
      throw new PraiseRequestError(result.error ?? submitErrorMessage(code), code, result.status)
    },
    onSuccess: (result) => {
      writeDraft("")
      queryClient.setQueryData<PraiseStateData>(praiseKeys.state(userId), (old) => {
        if (!old?.state.available) return old
        const state = old.state
        return {
          ...old,
          state: {
            ...state,
            totalCount: state.totalCount + 1,
            featured: state.featured ?? result.praise,
            me: state.me && { ...state.me, canSing: false, today: result.praise, total: state.me.total + 1 },
          },
        }
      })
    },
    onSettled: () => invalidateEconomy(queryClient),
  })
}

async function fetchRiddle(): Promise<RiddleState> {
  const res = await fetch("/api/praise/riddle", { cache: "no-store" })
  const json = await res.json().catch(() => null)
  if (res.ok) return json as RiddleState
  if (res.status === 503) return { available: false }
  const code = (json?.code ?? "unknown") as RiddleErrorCode
  throw new PraiseRequestError(json?.error ?? riddleErrorMessage(code), code, res.status)
}

// Within a day a riddle only moves forward (more answers, then solved or locked), so a refetch that started
// before an answer landed must not rewind the dialog to the riddle it replaced.
function isBehind(next: RiddleState, current: RiddleState | undefined): boolean {
  if (!current?.available || !next.available || next.day !== current.day) return false
  return next.number < current.number || (next.status === "open" && current.status !== "open")
}

// Today's King's Riddle, the first step of the hand kiss. { available: false } while its migration is missing.
export function useRiddle(userId: string | null, enabled: boolean) {
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: praiseKeys.riddle(userId),
    queryFn: async () => {
      const next = await fetchRiddle()
      const current = queryClient.getQueryData<RiddleState>(praiseKeys.riddle(userId))
      return isBehind(next, current) ? current! : next
    },
    enabled: enabled && !!userId,
    staleTime: 60_000,
    retry: 1,
  })
}

export interface RiddleInput {
  number: number
  answer: RiddleAnswer
}

export function useSolveRiddle(userId: string | null) {
  const queryClient = useQueryClient()
  return useMutation<RiddleSolveResult, PraiseRequestError<RiddleErrorCode>, RiddleInput>({
    mutationFn: async (input) => {
      const result = await postJson<RiddleSolveResult>("/api/praise/riddle", input)
      if (result.ok) return result.data
      const code = (result.code ?? "unknown") as RiddleErrorCode
      throw new PraiseRequestError(result.error ?? riddleErrorMessage(code), code, result.status)
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: praiseKeys.riddle(userId) })
    },
    onSuccess: (result) => {
      queryClient.setQueryData<RiddleState>(praiseKeys.riddle(userId), { available: true, ...result.view })
    },
    onError: (error) => {
      if (error.code === "no_riddle" || error.code === "riddle_limit" || error.code === "migration_pending") {
        queryClient.invalidateQueries({ queryKey: praiseKeys.riddle(userId) })
      }
    },
  })
}

interface JudgeInput {
  id: string
  verdict: PraiseVerdict
  note?: string | null
  // The favor the author's titles make a crown pay, for the optimistic update.
  favor?: number
}

export function useJudgePraise(userId: string | null) {
  const queryClient = useQueryClient()
  return useMutation<JudgeResult, PraiseRequestError<JudgeErrorCode>, JudgeInput, { snapshots: [QueryKey, unknown][] }>({
    mutationFn: async ({ id, verdict, note }) => {
      const result = await postJson<JudgeResult>(`/api/praise/${id}/judge`, { verdict, note: note ?? null })
      if (result.ok) return result.data
      const code = (result.code ?? "unknown") as JudgeErrorCode
      throw new PraiseRequestError(result.error ?? judgeErrorMessage(code), code, result.status)
    },
    onMutate: async ({ id, verdict, note, favor }) => {
      await queryClient.cancelQueries({ queryKey: praiseKeys.all })
      const snapshots = queryClient.getQueriesData({ queryKey: praiseKeys.all })
      const judgedAt = new Date().toISOString()
      const judge = (praise: PraiseView): PraiseView =>
        praise.id === id
          ? {
              ...praise,
              verdict,
              verdictNote: note?.trim() || null,
              judgedAt,
              favor: verdict === "crowned" ? (favor ?? ROYAL_FAVOR) : 0,
            }
          : praise
      queryClient.setQueriesData<HallPage>({ queryKey: ["praise", "hall"] }, (page) =>
        page ? { ...page, praises: page.praises.map(judge) } : page
      )
      queryClient.setQueryData<PraiseStateData>(praiseKeys.state(userId), (old) => {
        if (!old?.state.available || !old.state.court) return old
        const { court, featured } = old.state
        return {
          ...old,
          state: {
            ...old.state,
            featured: featured && judge(featured),
            court: {
              ...court,
              pending: Math.max(0, court.pending - 1),
              crownsLeft: verdict === "crowned" ? Math.max(0, court.crownsLeft - 1) : court.crownsLeft,
            },
          },
        }
      })
      return { snapshots }
    },
    onError: (_error, _input, context) => {
      context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: () => invalidateEconomy(queryClient),
  })
}

function gameRunning(queryClient: QueryClient): boolean {
  const active = queryClient.getQueryData<{ session: SessionWithAssignments | null }>(ACTIVE_SESSION_KEY)
  return !!active?.session && ACTIVE_STATUSES.includes(active.session.status)
}

// The live provider narrates other users' events during games; outside games these personal ones still matter.
export function usePraiseLiveToasts({
  userId,
  isSalaxe,
  onJudge,
}: {
  userId: string | null
  isSalaxe: boolean
  onJudge: () => void
}) {
  const queryClient = useQueryClient()
  useLiveSignal((signal) => {
    if (signal.kind !== "event" || !userId || gameRunning(queryClient)) return
    const { event } = signal
    if (event.type === "praise.sung" && isSalaxe && event.actor?.userId !== userId) {
      const data = event.data as LiveEventPayloads["praise.sung"]
      toast(`${event.actor?.name ?? "A subject"} sings for you`, {
        description: `"${data.excerpt}"`,
        action: { label: "Judge", onClick: onJudge },
      })
    }
    if (event.type === "praise.judged") {
      const data = event.data as LiveEventPayloads["praise.judged"]
      if (data.authorUserId !== userId) return
      if (data.verdict === "crowned") {
        toast.success(`Salaxe crowned your praise: +${data.delta} Royal Favor`, {
          description: data.note ? `"${data.note}"` : "Frame it. He already did.",
        })
      } else {
        toast(`Salaxe scorned your praise, in public`, {
          description: data.note ? `"${data.note}"` : "Your name went into the notebook. In pen.",
        })
      }
    }
  })
}
