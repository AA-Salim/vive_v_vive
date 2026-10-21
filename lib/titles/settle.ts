import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import type { GameResolvedContext } from "@/lib/game-hooks/types"
import { emitLive } from "@/lib/live/server"
import type { LiveEventPayloads } from "@/lib/live/events"
import type { Side } from "@/lib/types"
import { computePerkApplications, emptySubject, type PerkApplication, type PerkWearer } from "@/lib/titles/engine"
import type { PerkGame, PerkSubject } from "@/lib/titles/perk-kit"
import { brandState, earliest, isBrand, loadIdentities, loadLiveOwnership, loadResolvedGames } from "@/lib/titles/server"

const DEBT_FLOOR = -300
const PUBLIC_PERK_EVENTS = 4

interface SessionBet {
  user_id: string
  side: Side
  amount: number
  payout: number | null
  status: string
}

interface Applied extends PerkApplication {
  moved: number
}

export async function settleTitlePerks(ctx: GameResolvedContext): Promise<void> {
  const { supabase, sessionId, winnerSide, assignments } = ctx
  const playerIds = assignments.map((a) => a.player_id)

  const [ownership, sessionRes, salaxeRes, linkedRes, betsRes, chaosRes, bountyRes] = await Promise.all([
    loadLiveOwnership(supabase),
    supabase.from("game_sessions").select("created_at").eq("id", sessionId).maybeSingle(),
    supabase.from("players").select("id, auth_user_id").ilike("name", "salaxe").limit(1).maybeSingle(),
    supabase.from("players").select("id, auth_user_id").in("id", playerIds),
    supabase.from("bets").select("user_id, side, amount, payout, status").eq("session_id", sessionId),
    supabase.from("chaos_actions").select("user_id, cost, status").eq("session_id", sessionId),
    supabase.from("point_transactions").select("user_id, amount").eq("reference_id", sessionId).eq("reason", "bounty_claimed"),
  ])

  const sessionStart = sessionRes.data?.created_at ? Date.parse(sessionRes.data.created_at as string) : Date.now()
  const brands = ownership.filter((row) => isBrand(row, row.title) && Date.parse(row.created_at) < sessionStart)
  const resolved = await loadResolvedGames(supabase, earliest(brands.map((b) => b.created_at)))

  const wearers: PerkWearer[] = []
  const equippedUsers = new Set<string>()
  for (const row of [...ownership].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))) {
    if (!row.is_active || !row.title.for_self || equippedUsers.has(row.user_id)) continue
    equippedUsers.add(row.user_id)
    wearers.push({ userId: row.user_id, title: row.title.name, category: row.title.category, kind: "perk", bestowedBy: null })
  }
  for (const brand of brands) {
    if (!brandState(brand, brand.title.price, resolved, sessionId).active) continue
    wearers.push({
      userId: brand.user_id,
      title: brand.title.name,
      category: brand.title.category,
      kind: "curse",
      bestowedBy: brand.assigned_by,
    })
  }
  if (wearers.length === 0) return

  const salaxe = salaxeRes.data as { id: string; auth_user_id: string | null } | null
  const userByPlayer = new Map((linkedRes.data ?? []).map((p) => [p.id as string, p.auth_user_id as string | null]))
  const settledBets = ((betsRes.data ?? []) as SessionBet[]).filter((b) => b.status === "won" || b.status === "lost")

  const game: PerkGame = {
    sessionId,
    winnerSide,
    salaxeSide: assignments.find((a) => a.player_id === salaxe?.id)?.side ?? null,
    pool: settledBets.reduce((sum, b) => sum + b.amount, 0),
    backers: {
      blue: settledBets.filter((b) => b.side === "blue").length,
      red: settledBets.filter((b) => b.side === "red").length,
    },
  }

  const subjects = new Map<string, PerkSubject>()
  const subjectFor = (userId: string) => {
    let subject = subjects.get(userId)
    if (!subject) {
      subject = emptySubject(userId, !!salaxe?.auth_user_id && salaxe.auth_user_id === userId)
      subjects.set(userId, subject)
    }
    return subject
  }
  for (const a of assignments) {
    const userId = userByPlayer.get(a.player_id)
    if (userId) subjectFor(userId).play = { side: a.side, lane: a.lane, won: a.side === winnerSide }
  }
  for (const b of settledBets) {
    subjectFor(b.user_id).bet = { side: b.side, stake: b.amount, payout: b.payout ?? 0, won: b.status === "won" }
  }
  for (const c of (chaosRes.data ?? []) as { user_id: string; cost: number; status: string }[]) {
    if (c.status !== "refunded") subjectFor(c.user_id).chaosSpent += c.cost
  }
  for (const t of (bountyRes.data ?? []) as { user_id: string; amount: number }[]) {
    subjectFor(t.user_id).bountyClaimed += t.amount
  }

  const applications = computePerkApplications(game, subjects, wearers)
  if (applications.length === 0) return

  const applied = await applyAll(supabase, sessionId, applications)
  if (applied.length > 0) await announce(supabase, sessionId, applied)
}

async function applyAll(supabase: SupabaseClient, sessionId: string, applications: PerkApplication[]): Promise<Applied[]> {
  const applied: Applied[] = []
  for (let i = 0; i < applications.length; i++) {
    const app = applications[i]
    const { data, error } = await supabase.rpc("apply_title_perk", {
      p_session_id: sessionId,
      p_user_id: app.userId,
      p_title_name: app.title,
      p_kind: app.kind,
      p_amount: app.amount,
      p_detail: app.detail,
      p_beneficiary: app.beneficiary,
    })
    if (error) {
      if (isMissingSchema(error)) return [...applied, ...(await applyLegacy(supabase, sessionId, applications.slice(i)))]
      continue
    }
    const moved = typeof data === "number" ? data : 0
    if (moved !== 0) applied.push({ ...app, moved })
  }
  return applied
}

// Before the titles migration: no ledger table, so a wearer who already has a title_perk entry for this game is skipped.
async function applyLegacy(supabase: SupabaseClient, sessionId: string, applications: PerkApplication[]): Promise<Applied[]> {
  const userIds = [...new Set(applications.map((a) => a.userId))]
  const [{ data: existing }, { data: balances }] = await Promise.all([
    supabase.from("point_transactions").select("user_id").eq("reference_id", sessionId).eq("reason", "title_perk"),
    supabase.from("point_balances").select("user_id, balance").in("user_id", userIds),
  ])
  const done = new Set((existing ?? []).map((t) => t.user_id as string))
  const balance = new Map((balances ?? []).map((b) => [b.user_id as string, b.balance as number]))

  const applied: Applied[] = []
  for (const app of applications) {
    if (done.has(app.userId) || !balance.has(app.userId)) continue
    const current = balance.get(app.userId) ?? 0
    const moved = app.amount < 0 ? Math.min(0, Math.max(app.amount, DEBT_FLOOR - current)) : app.amount
    if (moved === 0) continue

    const { error } = await supabase.rpc("adjust_balance", {
      p_user_id: app.userId,
      p_amount: moved,
      p_reason: "title_perk",
      p_reference_id: sessionId,
    })
    if (error) {
      // The reason format check from the foundation migration is missing: nothing can be paid yet.
      if (error.code === "23514" && /reason/i.test(error.message)) return applied
      continue
    }
    balance.set(app.userId, current + moved)
    if (app.kind === "curse" && app.beneficiary) {
      await supabase.rpc("adjust_balance", {
        p_user_id: app.beneficiary,
        p_amount: -moved,
        p_reason: "title_tribute",
        p_reference_id: sessionId,
      })
    }
    applied.push({ ...app, moved })
  }
  return applied
}

async function announce(supabase: SupabaseClient, sessionId: string, applied: Applied[]) {
  const identities = await loadIdentities(supabase, applied.flatMap((a) => [a.userId, a.beneficiary ?? ""]))
  const nameOf = (userId: string | null) => (userId ? identities.get(userId)?.name ?? "Someone" : null)

  const rows: LiveEventPayloads["title.settled"]["applications"] = applied.map((a) => ({
    userId: a.userId,
    name: nameOf(a.userId) ?? "Someone",
    title: a.title,
    kind: a.kind,
    delta: a.moved,
    detail: a.detail,
    beneficiaryId: a.beneficiary,
    beneficiaryName: nameOf(a.beneficiary),
  }))
  emitLive("title.settled", { sessionId, data: { applications: rows } })

  const loudest = [...rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, PUBLIC_PERK_EVENTS)
  for (const row of loudest) {
    const identity = identities.get(row.userId)
    emitLive("title.perk", {
      sessionId,
      actor: { userId: row.userId, name: row.name, avatarUrl: identity?.avatarUrl ?? null },
      data: {
        title: row.title,
        perk: `${row.detail} (${row.delta > 0 ? "+" : ""}${row.delta})`,
        delta: row.delta,
        userId: row.userId,
        kind: row.kind,
        beneficiaryName: row.beneficiaryName ?? null,
      },
    })
  }
}
