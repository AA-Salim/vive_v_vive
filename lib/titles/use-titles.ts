"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { signed } from "@/lib/titles/copy"
import type { CourtResponse, MilestonesResponse, TitlesCatalogResponse } from "@/lib/titles/types"

export const TITLES_KEYS = {
  all: ["titles"] as const,
  catalog: ["titles", "catalog"] as const,
  court: ["titles", "court"] as const,
  milestones: ["titles", "milestones"] as const,
  wallet: ["points", "titles-wallet"] as const,
}

export class TitlesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string | null
  ) {
    super(message)
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new TitlesApiError(body?.error ?? "The court is not answering. Try again.", res.status, body?.code ?? null)
  return body as T
}

const post = <T>(url: string, payload: unknown) =>
  request<T>(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })

export function useTitlesCatalog() {
  return useQuery({
    queryKey: TITLES_KEYS.catalog,
    queryFn: () => request<TitlesCatalogResponse>("/api/titles"),
    staleTime: 15_000,
  })
}

export function useCourt(enabled: boolean) {
  return useQuery({
    queryKey: TITLES_KEYS.court,
    queryFn: () => request<CourtResponse>("/api/titles/court"),
    enabled,
    staleTime: 30_000,
  })
}

export function useMilestones(enabled: boolean) {
  return useQuery({
    queryKey: TITLES_KEYS.milestones,
    queryFn: () => request<MilestonesResponse>("/api/titles/milestones"),
    enabled,
    staleTime: 30_000,
  })
}

export function useWallet(enabled: boolean) {
  return useQuery({
    queryKey: TITLES_KEYS.wallet,
    queryFn: async () => (await request<{ balance: number }>("/api/points")).balance,
    enabled,
    staleTime: 10_000,
  })
}

function useRefreshTitles() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: TITLES_KEYS.all })
    queryClient.invalidateQueries({ queryKey: ["points"] })
  }
}

const fail = (error: Error) => toast.error(error.message)

export function useEquipTitle() {
  const queryClient = useQueryClient()
  const refresh = useRefreshTitles()
  return useMutation({
    mutationFn: (vars: { titleId: string | null; name?: string }) =>
      post<{ title: string | null }>("/api/titles/activate", { title_id: vars.titleId }),
    onMutate: async ({ titleId }) => {
      await queryClient.cancelQueries({ queryKey: TITLES_KEYS.catalog })
      const previous = queryClient.getQueryData<TitlesCatalogResponse>(TITLES_KEYS.catalog)
      if (previous) {
        queryClient.setQueryData<TitlesCatalogResponse>(TITLES_KEYS.catalog, {
          ...previous,
          active_title_id: titleId,
          collection: previous.collection.map((c) => ({ ...c, is_active: c.title_id === titleId })),
        })
      }
      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(TITLES_KEYS.catalog, context.previous)
      fail(error)
    },
    onSuccess: (_data, { titleId, name }) => {
      if (titleId) toast.success(`You are now known as ${name ?? "something new"}.`, { description: "The perk fires after your next game." })
      else toast("Banner lowered.", { description: "You are nobody again. Peaceful, honestly." })
    },
    onSettled: refresh,
  })
}

export function useBuyTitle() {
  const refresh = useRefreshTitles()
  return useMutation({
    mutationFn: async (vars: { titleId: string; name: string; targetUserId?: string; targetName?: string; equip?: boolean }) => {
      await post("/api/titles/buy", { title_id: vars.titleId, target_user_id: vars.targetUserId ?? null })
      if (!vars.equip) return { equipped: false, equipError: null as string | null }
      try {
        await post("/api/titles/activate", { title_id: vars.titleId })
        return { equipped: true, equipError: null }
      } catch (error) {
        return { equipped: false, equipError: error instanceof Error ? error.message : null }
      }
    },
    onSuccess: (result, vars) => {
      if (vars.targetUserId) {
        toast.success(`${vars.targetName ?? "They"} now bears the brand: ${vars.name}.`, {
          description: "The tribute flows to you. Try to look surprised.",
        })
      } else if (result.equipped) {
        toast.success(`${vars.name} is yours, and the banner is raised.`)
      } else {
        toast.success(`${vars.name} is yours.`, { description: result.equipError ?? "Equip it from your collection." })
      }
    },
    onError: fail,
    onSettled: refresh,
  })
}

export function useLiftCurse() {
  const refresh = useRefreshTitles()
  return useMutation({
    mutationFn: (vars: { titleId: string; name: string }) =>
      post<{ cost: number }>("/api/titles/dignity", { title_id: vars.titleId }),
    onSuccess: (data, vars) =>
      toast.success(`Dignity restored. ${vars.name} burns away.`, { description: `${signed(-data.cost)} points, well spent.` }),
    onError: fail,
    onSettled: refresh,
  })
}

export function useClaimMilestones() {
  const refresh = useRefreshTitles()
  return useMutation({
    mutationFn: (vars: { milestoneId?: string }) =>
      post<{ titles: string[] }>("/api/titles/milestones", vars.milestoneId ? { milestone_id: vars.milestoneId } : { all: true }),
    onSuccess: (data) => {
      const [first, ...rest] = data.titles
      toast.success(rest.length ? `Engraved ${data.titles.length} titles` : `Engraved: ${first}`, {
        description: "Equip one to put its perk to work.",
      })
    },
    onError: fail,
    onSettled: refresh,
  })
}
