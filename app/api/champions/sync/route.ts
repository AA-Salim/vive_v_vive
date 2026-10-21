import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import type { Role } from "@/lib/types"

const MERAKI_API_URL = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json"

const POSITION_MAPPING: Record<string, Role> = {
  TOP: "top",
  JUNGLE: "jungle",
  MIDDLE: "mid",
  BOTTOM: "adc",
  UTILITY: "support",
  SUPPORT: "support",
}

const merakiChampion = z.object({
  name: z.string(),
  key: z.string().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  positions: z.array(z.string()).optional(),
})

const merakiPayload = z.record(z.string(), z.unknown())

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const response = await fetch(MERAKI_API_URL, { cache: "no-store" }).catch(() => null)
  if (!response?.ok) {
    return NextResponse.json({ error: `Failed to fetch from Meraki: ${response?.statusText ?? "network error"}` }, { status: 502 })
  }

  const payload = merakiPayload.safeParse(await response.json().catch(() => null))
  if (!payload.success) return NextResponse.json({ error: "Unexpected Meraki payload" }, { status: 502 })

  const rows = new Map<string, { name: string; internal_name: string; role: Role }>()
  for (const raw of Object.values(payload.data)) {
    const champion = merakiChampion.safeParse(raw)
    if (!champion.success) continue
    const internalName = champion.data.key ?? String(champion.data.id ?? "")
    if (!internalName) continue
    for (const position of champion.data.positions ?? []) {
      const role = POSITION_MAPPING[position]
      if (role) rows.set(`${internalName}:${role}`, { name: champion.data.name, internal_name: internalName, role })
    }
  }

  if (rows.size === 0) return NextResponse.json({ message: "No champions found to sync" })

  const { error } = await supabase.from("champion_roles").upsert([...rows.values()], { onConflict: "internal_name,role" })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ message: "Successfully synced champions", count: rows.size })
}
