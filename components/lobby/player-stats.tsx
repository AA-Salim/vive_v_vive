import type { GameResult, RosterPlayer } from "@/lib/lobby/types"
import { cn } from "@/lib/utils"

const MIN_GAMES_FOR_RATE = 5

export function winRateOf(player: Pick<RosterPlayer, "wins" | "losses">): number | null {
  const games = player.wins + player.losses
  return games > 0 ? Math.round((player.wins / games) * 100) : null
}

export function WinRate({ player, className }: { player: Pick<RosterPlayer, "wins" | "losses">; className?: string }) {
  const rate = winRateOf(player)
  const games = player.wins + player.losses
  if (rate === null) return <span className={cn("text-xs text-muted-foreground", className)}>New</span>
  return (
    <span
      className={cn(
        "text-xs font-semibold tabular-nums",
        games < MIN_GAMES_FOR_RATE
          ? "text-muted-foreground"
          : rate >= 55
            ? "text-[var(--color-gold)]"
            : rate < 45
              ? "text-[var(--color-red-team)]/85"
              : "text-[var(--color-gold-light)]/85",
        className
      )}
      title={`${player.wins}W ${player.losses}L`}
    >
      {rate}%
    </span>
  )
}

export function FormDots({ form, className }: { form: GameResult[]; className?: string }) {
  if (form.length === 0) return null
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`Last ${form.length}: ${form.join(" ")}`}>
      {form.map((result, i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            result === "W" ? "bg-[var(--color-gold)]" : "bg-[var(--color-red-team)]/55"
          )}
        />
      ))}
    </span>
  )
}

export function relativeDays(iso: string | null, now: number): string | null {
  if (!iso || !now) return null
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000)
  if (Number.isNaN(days)) return null
  if (days <= 0) return "today"
  if (days === 1) return "yesterday"
  if (days < 30) return `${days} d ago`
  const months = Math.round(days / 30)
  return `${months} mo ago`
}

// Regulars first: games in the last month, then the most recent appearance, then career games.
export function byActivity(a: RosterPlayer, b: RosterPlayer): number {
  return (
    b.recent_games - a.recent_games ||
    (Date.parse(b.last_played_at ?? "") || 0) - (Date.parse(a.last_played_at ?? "") || 0) ||
    b.games_played - a.games_played ||
    a.name.localeCompare(b.name)
  )
}
