"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useLive, useLiveSignal } from "@/components/live/live-provider"
import { invalidationKeysFor, type LiveEventPayloads } from "@/lib/live/events"
import type { DecreeRequest } from "@/lib/chaos/schema"
import type { ChaosBoard, ChaosDecreeEntry, DecreeResponse } from "@/lib/chaos/types"

export class ChaosRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null
  ) {
    super(message)
  }
}

const NO_ACTIONS: ChaosDecreeEntry[] = []

export function chaosKey(sessionId: string | null) {
  return ["chaos", sessionId ?? "none"] as const
}

async function readError(res: Response, fallback: string) {
  const body = (await res.json().catch(() => null)) as { error?: string; code?: string } | null
  return new ChaosRequestError(body?.error ?? fallback, res.status, body?.code ?? null)
}

async function fetchBoard(sessionId: string): Promise<ChaosBoard> {
  const res = await fetch(`/api/sessions/${sessionId}/chaos?view=board`, { cache: "no-store" })
  if (!res.ok) throw await readError(res, "The royal ledger could not be read.")
  return res.json()
}

export function useChaos(sessionId: string | null, options: { poll?: boolean } = {}) {
  const queryClient = useQueryClient()
  const { userId } = useLive()
  const query = useQuery({
    queryKey: [...chaosKey(sessionId), "board", userId],
    queryFn: () => fetchBoard(sessionId as string),
    enabled: !!sessionId,
    staleTime: 2_000,
    refetchInterval: options.poll ? 8_000 : false,
  })

  useLiveSignal((signal) => {
    if (!sessionId || !userId || signal.kind !== "event") return
    const { event } = signal
    const roots = invalidationKeysFor(event)
    if (roots.includes("chaos") || !roots.includes("points")) return
    const mine =
      event.actor?.userId === userId ||
      (event.type === "points.changed" && (event.data as LiveEventPayloads["points.changed"]).userId === userId)
    if (mine) queryClient.invalidateQueries({ queryKey: chaosKey(sessionId) })
  })

  const { refetch: refetchQuery } = query
  const refetch = useCallback(async () => {
    await refetchQuery()
  }, [refetchQuery])

  return {
    actions: query.data?.actions ?? NO_ACTIONS,
    isLoading: !!sessionId && query.isPending,
    refetch,
    board: query.data ?? null,
    error: query.error,
    isError: query.isError,
  }
}

export function useIssueDecree(sessionId: string) {
  const queryClient = useQueryClient()
  const key = chaosKey(sessionId)

  return useMutation<DecreeResponse, ChaosRequestError, DecreeRequest, { snapshots: [readonly unknown[], ChaosBoard | undefined][] }>({
    mutationFn: async (request) => {
      const res = await fetch(`/api/sessions/${sessionId}/chaos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      }).catch(() => {
        throw new ChaosRequestError("Lost contact with the court. Check the ledger before trying again.", 0, "network")
      })
      if (!res.ok) throw await readError(res, "The decree failed. No points were taken.")
      return res.json()
    },
    onMutate: async (request) => {
      await queryClient.cancelQueries({ queryKey: key })
      const snapshots = queryClient.getQueriesData<ChaosBoard>({ queryKey: key })
      queryClient.setQueriesData<ChaosBoard>({ queryKey: key }, (board) => {
        if (!board?.viewer || board.viewer.balance == null) return board
        const cost = board.rules[request.action_type]?.cost ?? 0
        return { ...board, viewer: { ...board.viewer, balance: board.viewer.balance - cost } }
      })
      return { snapshots }
    },
    onError: (_error, _request, context) => {
      context?.snapshots.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data))
    },
    onSuccess: (result) => {
      queryClient.setQueriesData<ChaosBoard>({ queryKey: key }, (board) => {
        if (!board) return board
        return {
          ...board,
          actions: [...board.actions.filter((a) => a.id !== result.decree.id), result.decree],
          viewer: board.viewer ? { ...board.viewer, balance: result.balance ?? board.viewer.balance } : null,
        }
      })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key })
      queryClient.invalidateQueries({ queryKey: ["session"] })
      queryClient.invalidateQueries({ queryKey: ["points"] })
    },
  })
}

export interface DecreeHighlights {
  assignmentIds: ReadonlySet<string>
  playerIds: ReadonlySet<string>
}

// Assignments and players touched by a decree in the last few seconds, for map and roster highlights.
export function useDecreeHighlights(sessionId: string | null, ttlMs = 4500): DecreeHighlights {
  const [marks, setMarks] = useState<{ key: string; assignmentIds: string[]; playerIds: string[] }[]>([])
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useLiveSignal((signal) => {
    if (signal.kind !== "event" || signal.event.type !== "chaos.decree") return
    if (sessionId && signal.event.sessionId && signal.event.sessionId !== sessionId) return
    const data = signal.event.data as LiveEventPayloads["chaos.decree"]
    const assignmentIds = data.changedAssignmentIds ?? []
    const playerIds = data.changedPlayerIds ?? []
    if (assignmentIds.length === 0 && playerIds.length === 0) return
    const key = data.actionId ?? signal.event.id
    setMarks((prev) => [...prev.filter((m) => m.key !== key), { key, assignmentIds, playerIds }])
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      setMarks((prev) => prev.filter((m) => m.key !== key))
    }, ttlMs)
    timers.current.add(timer)
  })

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  return useMemo(
    () => ({
      assignmentIds: new Set(marks.flatMap((m) => m.assignmentIds)),
      playerIds: new Set(marks.flatMap((m) => m.playerIds)),
    }),
    [marks]
  )
}
