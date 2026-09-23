import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const { data: acts } = await supabase
    .from("acts")
    .select("*")
    .order("act_number", { ascending: true })

  return NextResponse.json({ acts: acts ?? [] })
}
