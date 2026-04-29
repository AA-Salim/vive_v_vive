import { NextResponse } from "next/server"
import { getChampionPools } from "@/lib/champions-db"

export async function GET() {
  try {
    const pools = await getChampionPools()
    return NextResponse.json(pools)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
