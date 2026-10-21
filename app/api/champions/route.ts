import { NextResponse } from "next/server"
import { getChampionPools } from "@/lib/champions-db"

export async function GET() {
  try {
    return NextResponse.json(await getChampionPools())
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load champions" }, { status: 500 })
  }
}
