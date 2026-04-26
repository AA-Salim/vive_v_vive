import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()
  const today = new Date().toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("daily_fearless")
    .select("champion_name")
    .eq("date", today)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const champions = data?.map((row) => row.champion_name) ?? []
  return NextResponse.json(champions)
}
