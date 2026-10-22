import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { NO_STORE } from "@/lib/duels/server/respond"
import { loadRoster } from "@/lib/duels/server/roster"

export async function GET() {
  const supabase = await createClient()
  try {
    return NextResponse.json({ duelists: await loadRoster(supabase) }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "The court registry is closed. Try again." }, { status: 500, headers: NO_STORE })
  }
}
