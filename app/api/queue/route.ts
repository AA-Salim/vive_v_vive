import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("player_queue")
    .select("*, players:player_id ( id, name )")
    .order("position", { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  switch (body.action) {
    case "join": {
      if (!body.player_id) {
        return NextResponse.json({ error: "player_id required" }, { status: 400 })
      }

      const { data: maxPos } = await supabase
        .from("player_queue")
        .select("position")
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle()

      const nextPosition = (maxPos?.position ?? 0) + 1

      const { error } = await supabase
        .from("player_queue")
        .insert({ player_id: body.player_id, position: nextPosition })

      if (error) {
        if (error.code === "23505") {
          return NextResponse.json({ error: "Player already in queue" }, { status: 409 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, position: nextPosition })
    }

    case "leave": {
      if (!body.player_id) {
        return NextResponse.json({ error: "player_id required" }, { status: 400 })
      }

      const { data: removed } = await supabase
        .from("player_queue")
        .delete()
        .eq("player_id", body.player_id)
        .select()
        .maybeSingle()

      if (!removed) {
        return NextResponse.json({ error: "Player not in queue" }, { status: 404 })
      }

      // Reorder remaining positions
      const { data: remaining } = await supabase
        .from("player_queue")
        .select("id")
        .order("position", { ascending: true })

      if (remaining) {
        for (let i = 0; i < remaining.length; i++) {
          await supabase
            .from("player_queue")
            .update({ position: i + 1 })
            .eq("id", remaining[i].id)
        }
      }

      return NextResponse.json({ success: true })
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${body.action}` }, { status: 400 })
  }
}
