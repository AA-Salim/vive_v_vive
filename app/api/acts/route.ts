import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

export async function GET() {
  const supabase = await createClient()

  const { data: act } = await supabase
    .from("acts")
    .select("*")
    .eq("status", "active")
    .maybeSingle()

  return NextResponse.json({ act })
}
