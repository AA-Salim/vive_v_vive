import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

const MERAKI_API_URL = "https://cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json"

const POSITION_MAPPING: Record<string, string> = {
  "TOP": "top",
  "JUNGLE": "jungle",
  "MIDDLE": "mid",
  "BOTTOM": "adc",
  "UTILITY": "support",
  "SUPPORT": "support"
}

export async function POST() {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated and is an admin (optional, but good for safety)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const response = await fetch(MERAKI_API_URL)
    if (!response.ok) {
      throw new Error(`Failed to fetch from Meraki: ${response.statusText}`)
    }

    const championsData = await response.json()
    const champions = Object.values(championsData)

    const upsertData: any[] = []

    for (const champion of champions as any[]) {
      const positions = champion.positions || []
      const internalName = champion.key || champion.id // Meraki's "key" is usually the string ID (e.g. "Aatrox")
      
      for (const pos of positions) {
        const role = POSITION_MAPPING[pos]
        if (role) {
          upsertData.push({
            name: champion.name,
            internal_name: internalName,
            role: role
          })
        }
      }
    }

    if (upsertData.length === 0) {
      return NextResponse.json({ message: "No champions found to sync" })
    }

    // Clear existing data or use upsert with ON CONFLICT
    // For simplicity, we'll use upsert. 
    // We need a policy that allows the authenticated user to insert into champion_roles
    // or use a service role client.
    
    const { error } = await supabase
      .from("champion_roles")
      .upsert(upsertData, { onConflict: "internal_name,role" })

    if (error) {
      console.error("Sync error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ 
      message: "Successfully synced champions", 
      count: upsertData.length 
    })

  } catch (err: any) {
    console.error("Sync caught error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
