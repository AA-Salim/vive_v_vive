import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: titles } = await supabase
    .from("titles")
    .select("*")
    .order("category")
    .order("price", { ascending: true })

  let ownedTitles: { title_id: string; is_active: boolean }[] = []
  if (user) {
    const { data } = await supabase
      .from("user_titles")
      .select("title_id, is_active")
      .eq("user_id", user.id)
    ownedTitles = data ?? []
  }

  const ownedSet = new Set(ownedTitles.map((t) => t.title_id))
  const activeId = ownedTitles.find((t) => t.is_active)?.title_id ?? null

  return NextResponse.json({
    titles: titles ?? [],
    owned: [...ownedSet],
    active_title_id: activeId,
  })
}
