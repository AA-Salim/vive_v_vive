import type { SupabaseClient } from "@supabase/supabase-js"
import { loadAccounts } from "@/lib/duels/server/accounts"
import type { RosterEntry } from "@/lib/duels/types"

// Every account that could be named in a challenge. Without a purse an account can never answer, so it is flagged.
// Any failed read throws: a roster that wrongly marks everyone purse-less is worse than an error with a retry.
export async function loadRoster(supabase: SupabaseClient): Promise<RosterEntry[]> {
  const [accounts, balances] = await Promise.all([
    loadAccounts(supabase, undefined, true),
    supabase.from("point_balances").select("user_id"),
  ])
  if (balances.error) throw new Error(balances.error.message)

  const withPurse = new Set(((balances.data ?? []) as { user_id: string }[]).map((b) => b.user_id))
  return [...accounts.values()]
    .map((account) => ({ ...account, hasPurse: withPurse.has(account.userId) }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
}
