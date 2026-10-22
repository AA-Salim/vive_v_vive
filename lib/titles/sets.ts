import { titleRulesV2 } from "@/lib/titles/rules-version"

// Set bonuses, mirrored in supabase/phase10_title-effects.sql (title_sets, title_set_members). What a completed set
// does lives in the effect table under the set's name (TITLE_EFFECTS_V2 in lib/titles/effects.ts), so the usual
// combine-and-clamp rules apply to it like to any other source. Version 2 rules only.

export interface TitleSet {
  name: string
  needs: number
  blurb: string
  members: readonly string[]
}

export const TITLE_SETS: readonly TitleSet[] = [
  {
    name: "Rebel Court",
    needs: 3,
    blurb: "Three rebellion titles: the uprising gets organized.",
    members: ["The Usurper", "Kingslayer", "The One Who Stopped Kneeling", "Crown Thief", "The Disrespector"],
  },
  {
    name: "Loyal Court",
    needs: 3,
    blurb: "Three loyalty or devotion titles: the throne notices.",
    members: [
      "Copium Dealer",
      "Last Loyalist",
      "The Holdout",
      "Still Kneeling",
      "Throne Polisher",
      "Salaxe Appreciator",
      "Devoted Servant",
      "Down Horrendous For Salaxe",
    ],
  },
  {
    name: "High Roller",
    needs: 2,
    blurb: "Two gambler titles: the house starts to sweat.",
    members: ["Copium Dealer", "The 0/8 Powerspike", "Baron Caller (Derogatory)", "Crown Thief", "The Holdout"],
  },
  {
    name: "Chaos Crew",
    needs: 3,
    blurb: "All three chaos honors: chaos, at wholesale prices.",
    members: ["Mischief Maker", "Chaos Enjoyer", "Chaos Incarnate"],
  },
]

const SET_NAMES = new Set(TITLE_SETS.map((s) => s.name))

export function isSetName(name: string): boolean {
  return SET_NAMES.has(name)
}

export function liveSets(): readonly TitleSet[] {
  return titleRulesV2() ? TITLE_SETS : []
}

export function titleSet(name: string): TitleSet | null {
  return liveSets().find((s) => s.name === name) ?? null
}

// The sets a title belongs to.
export function setsOf(title: string): TitleSet[] {
  return liveSets().filter((s) => s.members.includes(title))
}

export interface SetProgress {
  set: TitleSet
  worn: string[]
  count: number
  active: boolean
}

// How far a loadout (equipped self titles that still work) is into every set: "2/3 for Rebel Court".
export function setProgress(worn: readonly string[]): SetProgress[] {
  const wearing = new Set(worn)
  return liveSets().map((set) => {
    const inSet = set.members.filter((m) => wearing.has(m))
    return { set, worn: inSet, count: inSet.length, active: inSet.length >= set.needs }
  })
}

export function activeSets(worn: readonly string[]): TitleSet[] {
  return setProgress(worn)
    .filter((p) => p.active)
    .map((p) => p.set)
}

export function progressLabel(progress: Pick<SetProgress, "count" | "set">): string {
  return `${Math.min(progress.count, progress.set.needs)}/${progress.set.needs} for ${progress.set.name}`
}
