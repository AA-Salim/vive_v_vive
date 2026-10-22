import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { roman } from "@/lib/lore/herald/kit"
import { consolationDescription, consolationTitle, rewardCopy } from "@/lib/lore/rewards"

export const CLAIM_REASON = "act_carryover"
export const CONSOLATION_PREFIX = "consolation-"

interface ActRef {
  id: number
  act_number: number
  name: string
  status?: string
}

type One<T> = T | T[] | null | undefined

function one<T>(value: One<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

export interface ClaimableAward {
  id: string
  category: string
  title: string
  carry_over_bonus: number
  final_value: string | null
  acts: { act_number: number; name: string } | null
  is_consolation: boolean
}

export type ClaimResult =
  | { ok: true; title: string; bonus: number; consolation: boolean }
  | { ok: false; status: number; error: string }

// point_transactions.reference_id is a UUID: a consolation claim needs a stable one per act.
export function consolationRef(actId: number): string {
  const hex = createHash("sha256").update(`vvv:consolation:${actId}`).digest("hex")
  const variant = ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(18, 20)}-${hex.slice(20, 32)}`
}

async function ownedTitleNames(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("user_titles").select("titles:title_id ( name )").eq("user_id", userId)
  const names = ((data ?? []) as { titles: One<{ name: string }> }[]).map((row) => one(row.titles)?.name)
  return new Set(names.filter((n): n is string => !!n))
}

async function claimMarkers(supabase: SupabaseClient, userId: string): Promise<Set<string>> {
  const { data } = await supabase.from("point_transactions").select("reference_id").eq("user_id", userId).eq("reason", CLAIM_REASON)
  return new Set(((data ?? []) as { reference_id: string | null }[]).map((t) => t.reference_id).filter((r): r is string => !!r))
}

export async function listClaimable(supabase: SupabaseClient, userId: string): Promise<ClaimableAward[] | null> {
  const [markers, owned, awardsRes, snapshotsRes] = await Promise.all([
    claimMarkers(supabase, userId),
    ownedTitleNames(supabase, userId),
    supabase.from("act_awards").select("id, act_id, category, title, carry_over_bonus, final_value, acts:act_id ( id, act_number, name )").eq("user_id", userId),
    supabase.from("act_snapshots").select("act_id, acts:act_id ( id, act_number, name, status )").eq("user_id", userId),
  ])
  if (awardsRes.error) return null

  type AwardRow = Omit<ClaimableAward, "acts" | "is_consolation"> & { act_id: number; acts: One<ActRef> }
  const awards = (awardsRes.data ?? []) as unknown as AwardRow[]
  // Zero-bonus awards used to be marked with an insert that RLS rejects: owning the title is proof enough.
  const claimed = (award: AwardRow) => markers.has(award.id) || (award.carry_over_bonus <= 0 && owned.has(award.title))
  const real: ClaimableAward[] = awards
    .filter((award) => !claimed(award))
    .map((award) => {
      const act = one(award.acts)
      return {
        id: award.id,
        category: award.category,
        title: award.title,
        carry_over_bonus: award.carry_over_bonus,
        final_value: award.final_value,
        acts: act ? { act_number: act.act_number, name: act.name } : null,
        is_consolation: false,
      }
    })

  const consolation: ClaimableAward[] = []
  for (const snapshot of (snapshotsRes.data ?? []) as unknown as { act_id: number; acts: One<ActRef> }[]) {
    const act = one(snapshot.acts)
    if (!act || act.status !== "archived" || awards.some((a) => a.act_id === act.id)) continue
    const title = consolationTitle(userId, act.id, act.act_number)
    if (markers.has(consolationRef(act.id)) || owned.has(title)) continue
    consolation.push({
      id: `${CONSOLATION_PREFIX}${act.id}`,
      category: "consolation",
      title,
      carry_over_bonus: 0,
      final_value: null,
      acts: { act_number: act.act_number, name: act.name },
      is_consolation: true,
    })
  }
  return [...real, ...consolation]
}

async function ensureTitle(supabase: SupabaseClient, name: string, description: string): Promise<string | null> {
  const existing = await supabase.from("titles").select("id").eq("name", name).maybeSingle()
  if (existing.data) return existing.data.id as string
  const created = await supabase
    .from("titles")
    .insert({ name, description, price: 0, category: "award", for_self: true, is_permanent: true })
    .select("id")
    .single()
  if (created.data) return created.data.id as string
  const raced = await supabase.from("titles").select("id").eq("name", name).maybeSingle()
  return (raced.data?.id as string | undefined) ?? null
}

const ENGRAVER_FAILED: ClaimResult = { ok: false, status: 500, error: "The engraver slipped. Try again." }

// True once the user owns the title. Nothing is paid before that, so a failed engraving can simply be retried.
async function engrave(supabase: SupabaseClient, userId: string, name: string, description: string): Promise<boolean> {
  const titleId = await ensureTitle(supabase, name, description)
  if (!titleId) return false
  const { data } = await supabase.from("user_titles").select("id").eq("user_id", userId).eq("title_id", titleId).maybeSingle()
  if (data) return true
  const { error } = await supabase.from("user_titles").insert({ user_id: userId, title_id: titleId, is_active: false })
  return !error || error.code === "23505"
}

type Payment = { kind: "award"; awardId: string; bonus: number } | { kind: "consolation"; actId: number; marker: string }

function payFailure(error: { code?: string; message?: string }): ClaimResult {
  if (error.code === "23505" || /already_claimed/.test(error.message ?? "")) return { ok: false, status: 409, error: "Already claimed" }
  if (/award:(not_found|not_eligible)/.test(error.message ?? "")) return { ok: false, status: 403, error: "Not eligible" }
  return { ok: false, status: 500, error: "The treasury jammed. Try again." }
}

// Every claim leaves an act_carryover row (a zero-amount one when there is no bonus): that row is what marks the
// reward as claimed. claim_act_award / claim_act_consolation (phase10_hardening.sql) check the reward belongs to
// the caller and pay it once; adjust_balance is the pre-hardening path.
async function pay(supabase: SupabaseClient, userId: string, payment: Payment): Promise<ClaimResult | null> {
  const guarded =
    payment.kind === "award"
      ? await supabase.rpc("claim_act_award", { p_award_id: payment.awardId })
      : await supabase.rpc("claim_act_consolation", { p_act_id: payment.actId })
  if (!guarded.error) return null
  if (!isMissingSchema(guarded.error)) return payFailure(guarded.error)

  const { error } = await supabase.rpc("adjust_balance", {
    p_user_id: userId,
    p_amount: payment.kind === "award" ? Math.max(0, payment.bonus) : 0,
    p_reason: CLAIM_REASON,
    p_reference_id: payment.kind === "award" ? payment.awardId : payment.marker,
  })
  return error ? payFailure(error) : null
}

export async function claimAward(supabase: SupabaseClient, userId: string, awardId: string): Promise<ClaimResult> {
  const { data } = await supabase
    .from("act_awards")
    .select("id, category, title, carry_over_bonus, acts:act_id ( act_number )")
    .eq("id", awardId)
    .eq("user_id", userId)
    .maybeSingle()
  const award = data as { id: string; category: string; title: string; carry_over_bonus: number; acts: One<{ act_number: number }> } | null
  if (!award) return { ok: false, status: 404, error: "Award not found" }

  const [markers, owned] = await Promise.all([claimMarkers(supabase, userId), ownedTitleNames(supabase, userId)])
  if (markers.has(award.id) || (award.carry_over_bonus <= 0 && owned.has(award.title))) {
    return { ok: false, status: 409, error: "Already claimed" }
  }

  const actNumber = one(award.acts)?.act_number ?? 1
  const description = `Engraved for ${rewardCopy(award.category).label} in Act ${roman(actNumber)}.`
  if (!(await engrave(supabase, userId, award.title, description))) return ENGRAVER_FAILED
  const failed = await pay(supabase, userId, { kind: "award", awardId: award.id, bonus: award.carry_over_bonus })
  if (failed) return failed
  return { ok: true, title: award.title, bonus: Math.max(0, award.carry_over_bonus), consolation: false }
}

export async function claimConsolation(supabase: SupabaseClient, userId: string, reference: string): Promise<ClaimResult> {
  const actId = Number(reference.slice(CONSOLATION_PREFIX.length))
  const [snapshotRes, actRes, awardRes] = await Promise.all([
    supabase.from("act_snapshots").select("act_id").eq("user_id", userId).eq("act_id", actId).maybeSingle(),
    supabase.from("acts").select("id, act_number, status").eq("id", actId).maybeSingle(),
    supabase.from("act_awards").select("id").eq("user_id", userId).eq("act_id", actId).limit(1),
  ])
  const act = actRes.data as { id: number; act_number: number; status: string } | null
  if (!snapshotRes.data || !act || act.status !== "archived" || (awardRes.data ?? []).length > 0) {
    return { ok: false, status: 403, error: "Not eligible" }
  }

  const title = consolationTitle(userId, act.id, act.act_number)
  const marker = consolationRef(act.id)
  const [markers, owned] = await Promise.all([claimMarkers(supabase, userId), ownedTitleNames(supabase, userId)])
  if (markers.has(marker) || owned.has(title)) return { ok: false, status: 409, error: "Already claimed" }

  if (!(await engrave(supabase, userId, title, consolationDescription(act.act_number)))) return ENGRAVER_FAILED
  const failed = await pay(supabase, userId, { kind: "consolation", actId: act.id, marker })
  if (failed) return failed
  return { ok: true, title, bonus: 0, consolation: true }
}
