import { createClient } from "@/lib/supabase"
import type { Act, AwardCategory } from "@/lib/types"

export const ACT_CATEGORIES: {
  category: AwardCategory
  label: string
  description: string
  titleName: string
}[] = [
  {
    category: "treasury",
    label: "The Treasury",
    description: "Highest point balance",
    titleName: "Grand Champion",
  },
  {
    category: "warrior",
    label: "The Warrior",
    description: "Best win rate (min 5 games)",
    titleName: "Warrior",
  },
  {
    category: "iron_man",
    label: "The Iron Man",
    description: "Most games played",
    titleName: "Iron Man",
  },
  {
    category: "degenerate",
    label: "The Degenerate",
    description: "Most bets placed",
    titleName: "Degenerate",
  },
  {
    category: "devotee",
    label: "The Devotee",
    description: "Most kisses given",
    titleName: "Devotee",
  },
  {
    category: "punching_bag",
    label: "The Punching Bag",
    description: "Most times shamed",
    titleName: "Punching Bag",
  },
]

export async function getCurrentAct(): Promise<Act | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("acts")
    .select("*")
    .eq("status", "active")
    .maybeSingle()
  return data
}

export async function getArchivedActs(): Promise<Act[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("acts")
    .select("*")
    .eq("status", "archived")
    .order("act_number", { ascending: true })
  return data ?? []
}
