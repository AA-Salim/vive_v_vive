import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { loadOpenTribunal } from "@/lib/prophecy/tribunal"
import type { OpenTribunalResponse } from "@/lib/prophecy/types"

// Latest tribunal that is still voting or settled in the last few minutes; also settles any due vote.
export async function GET() {
  const supabase = await createClient()
  try {
    const { enabled, tribunal } = await loadOpenTribunal(supabase)
    const body: OpenTribunalResponse = { enabled, now: new Date().toISOString(), tribunal }
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "The tribunal could not be reached." }, { status: 500 })
  }
}
