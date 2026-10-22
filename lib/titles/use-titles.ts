"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useLiveSignal } from "@/components/live/live-provider"
import { showEquipToast } from "@/components/titles/equip-moment"
import { perkInfo } from "@/lib/titles/catalog"
import { signed } from "@/lib/titles/copy"
import { titleEffects } from "@/lib/titles/effects"
import type { CourtResponse, MilestonesResponse, PerkInfo, TitleRarity, TitlesCatalogResponse, TitleView } from "@/lib/titles/types"

export const TITLES_KEYS = {
  all: ["titles"] as const,
  catalog: ["titles", "catalog"] as const,
  court: ["titles", "court"] as const,
  milestones: ["titles", "milestones"] as const,
  wallet: (userId: string | null) => ["points", userId ?? "anonymous", "titles-wallet"] as const,
}

// Optional details of the banner being raised, for the "title moment" toast.
interface BannerLook {
  category?: string
  rarity?: TitleRarity
  wearer?: string | null
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

export function useWallet(userId: string | null) {
  return useQuery({
    queryKey: TITLES_KEYS.wallet(userId),
    queryFn: async () => (await request<{ balance: number }>("/api/points")).balance,
    enabled: !!userId,
    staleTime: 10_000,
  })
}

// The seal flips when a game goes live, and session events do not refresh the titles roots on their own.
export function useTitlesLockSync() {
  const queryClient = useQueryClient()
  useLiveSignal((signal) => {
    const sessionMoved =
      (signal.kind === "event" && signal.event.type === "session.status") ||
      (signal.kind === "db" && signal.table === "game_sessions")
    if (sessionMoved) queryClient.invalidateQueries({ queryKey: TITLES_KEYS.catalog })
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
    mutationFn: (vars: { titleId: string | null; name?: string } & BannerLook) =>
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
    onSuccess: (_data, { titleId, name, category, rarity, wearer }) => {
      if (titleId && name && category) showEquipToast({ title: name, category, rarity, wearer })
      else if (titleId) toast.success(`You are now known as ${name ?? "something new"}.`, { description: "The perk fires after your next game." })
      else toast("Banner lowered.", { description: "You are nobody again. Peaceful, honestly." })
    },
    onSettled: refresh,
  })
}

export interface LoadoutResult {
  title_ids: string[]
  titles: string[]
  primary: string | null
  // What the whole loadout does now, one line per effect (combined and capped).
  effects: string[]
}

// What a single title does, for toasts: its immediate effects, then its post-game perk.
export function titleToastLines(title: { name: string; category: string; perk?: PerkInfo | null }): string {
  const lines = titleEffects(title.name).map((e) => e.text)
  const perk = title.perk ?? perkInfo(title.name, title.category)
  if (perk && perk.kind === "perk") lines.push(`After each game: ${perk.summary}`)
  return lines.length ? lines.join(" · ") : "Cosmetic: pure prestige, no effect."
}

// Replaces the whole loadout. `change` names the title that was put on or taken off, for the toast.
export function useSetLoadout() {
  const queryClient = useQueryClient()
  const refresh = useRefreshTitles()
  return useMutation({
    mutationFn: (vars: { titleIds: string[]; change?: { title: TitleView; equipped: boolean; wearer?: string | null } }) =>
      post<LoadoutResult>("/api/titles/loadout", { title_ids: vars.titleIds }),
    onMutate: async ({ titleIds }) => {
      await queryClient.cancelQueries({ queryKey: TITLES_KEYS.catalog })
      const previous = queryClient.getQueryData<TitlesCatalogResponse>(TITLES_KEYS.catalog)
      if (previous) {
        const ids = new Set(titleIds)
        queryClient.setQueryData<TitlesCatalogResponse>(TITLES_KEYS.catalog, {
          ...previous,
          active_title_ids: titleIds,
          collection: previous.collection.map((c) => ({ ...c, is_active: ids.has(c.title_id) })),
        })
      }
      return { previous }
    },
    onError: (error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(TITLES_KEYS.catalog, context.previous)
      fail(error)
    },
    onSuccess: (result, { change }) => {
      if (!change) return
      if (change.equipped) {
        showEquipToast({ title: change.title.name, category: change.title.category, rarity: change.title.rarity, wearer: change.wearer })
      } else {
        toast(`${change.title.name} taken off`, {
          description: result.titles.length ? `${result.titles.length} title${result.titles.length === 1 ? "" : "s"} still worn.` : "No banner raised. Peaceful, honestly.",
        })
      }
    },
    onSettled: refresh,
  })
}

interface BuyVars extends BannerLook {
  titleId: string
  name: string
  targetUserId?: string
  targetName?: string
  // The whole loadout to wear once bought (the current one plus this title). Omit to keep it in the collection.
  equipWith?: string[]
  // Legacy single-banner equip, kept for older callers.
  equip?: boolean
  title?: Pick<TitleView, "name" | "category" | "perk">
}

interface BuyResult {
  equipped: boolean
  equipError: string | null
  price: number | null
}

export function useBuyTitle() {
  const refresh = useRefreshTitles()
  return useMutation({
    mutationFn: async (vars: BuyVars): Promise<BuyResult> => {
      const bought = await post<{ price?: number | null }>("/api/titles/buy", {
        title_id: vars.titleId,
        target_user_id: vars.targetUserId ?? null,
      })
      const price = typeof bought?.price === "number" ? bought.price : null
      if (!vars.equipWith && !vars.equip) return { equipped: false, equipError: null, price }
      try {
        if (vars.equipWith) await post<LoadoutResult>("/api/titles/loadout", { title_ids: vars.equipWith })
        else await post("/api/titles/activate", { title_id: vars.titleId })
        return { equipped: true, equipError: null, price }
      } catch (error) {
        return { equipped: false, equipError: error instanceof Error ? error.message : null, price }
      }
    },
    onSuccess: (result, vars) => {
      if (vars.targetUserId) {
        toast.success(`${vars.targetName ?? "They"} now bears the brand: ${vars.name}.`, {
          description: `${result.price != null ? `${result.price.toLocaleString("en-US")} points well spent. ` : ""}The tribute flows to you. Try to look surprised.`,
        })
        return
      }
      const does = titleToastLines(vars.title ?? { name: vars.name, category: vars.category ?? "" })
      const category = vars.category ?? vars.title?.category
      if (result.equipped && category) {
        showEquipToast({ title: vars.name, category, rarity: vars.rarity, wearer: vars.wearer })
      } else if (result.equipped) {
        toast.success(`${vars.name} is yours, and it is equipped.`, { description: does })
      } else {
        toast.success(`${vars.name} is yours.`, {
          description: result.equipError ? `${result.equipError} ${does}` : `Equip it from your collection. ${does}`,
        })
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
