// What an action does and what it costs, shown in an InfoTip. Build entries from each feature's rule constants
// (never retype numbers) so the bubble always matches what the server charges.
export interface HelpEntry {
  title: string
  does: string
  cost: string
  reward?: string
  limits?: string
}

export const FREE = "Free"

export const pts = (n: number) => `${n.toLocaleString("en-US")} ${Math.abs(n) === 1 ? "point" : "points"}`

export const ptsRange = (min: number, max: number) => `${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")} points`

export const pct = (ratio: number) => `${Math.round(ratio * 100)}%`
