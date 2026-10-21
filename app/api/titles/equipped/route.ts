import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export interface EquippedTitle {
  userId: string
  playerId: string | null
  title: string
  category: string
  perk: string | null
}

export async function GET() {
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from("user_titles")
    .select("user_id, titles ( name, category )")
    .eq("is_active", true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const userIds = (rows ?? []).map((r) => r.user_id as string)
  const { data: players } = userIds.length
    ? await supabase.from("players").select("id, auth_user_id").in("auth_user_id", userIds)
    : { data: [] as { id: string; auth_user_id: string }[] }
  const playerByUser = new Map((players ?? []).map((p) => [p.auth_user_id as string, p.id as string]))

  const equipped: EquippedTitle[] = (rows ?? []).flatMap((r) => {
    const t = (Array.isArray(r.titles) ? r.titles[0] : r.titles) as { name: string; category: string } | null
    if (!t) return []
    return [{ userId: r.user_id as string, playerId: playerByUser.get(r.user_id as string) ?? null, title: t.name, category: t.category, perk: null }]
  })

  return NextResponse.json(equipped)
}
