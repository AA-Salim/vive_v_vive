import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { TITLE_RULES_HEADER, titleRulesVersion } from "@/lib/titles/rules-version"
import { buildEquippedTitles } from "@/lib/titles/server"

export type { EquippedTitle } from "@/lib/titles/types"

export async function GET() {
  const supabase = await createClient()
  try {
    const equipped = await buildEquippedTitles(supabase)
    // The body stays a plain list for older clients; the title rules ride in a header.
    return NextResponse.json(equipped, { headers: { [TITLE_RULES_HEADER]: String(titleRulesVersion()) } })
  } catch {
    return NextResponse.json({ error: "Could not read the royal register" }, { status: 500 })
  }
}
