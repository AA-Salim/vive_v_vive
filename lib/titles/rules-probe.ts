import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import { setTitleRulesVersion, titleRulesVersion, type TitleRulesVersion } from "@/lib/titles/rules-version"

const RECHECK_MS = 30_000
let checkedAt = 0
let inflight: Promise<TitleRulesVersion> | null = null

// Server side: version 2 once title_sets exists (phase10_title-effects.sql commits it together with everything
// else). Rechecked every 30 s so the switch follows the migration without a redeploy. A failed probe that is not a
// missing table keeps the last answer.
export function syncTitleRules(supabase: SupabaseClient): Promise<TitleRulesVersion> {
  if (Date.now() - checkedAt < RECHECK_MS) return Promise.resolve(titleRulesVersion())
  inflight ??= (async () => {
    try {
      const { error } = await supabase.from("title_sets").select("set_name").limit(1)
      if (!error) setTitleRulesVersion(2)
      else if (isMissingSchema(error)) setTitleRulesVersion(1)
      checkedAt = Date.now()
    } catch {
      // Unreachable database: keep the current rules.
    } finally {
      inflight = null
    }
    return titleRulesVersion()
  })()
  return inflight
}
