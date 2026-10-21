import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { buildEquippedTitles } from "@/lib/titles/server"

export type { EquippedTitle } from "@/lib/titles/types"

export async function GET() {
  const supabase = await createClient()
  try {
    return NextResponse.json(await buildEquippedTitles(supabase))
  } catch {
    return NextResponse.json({ error: "Could not read the royal register" }, { status: 500 })
  }
}
