import { cn } from "@/lib/utils"

interface DuoShowcaseCardProps {
  playerA: string
  playerB: string
  label: string
  labelText: string
  wins: number
  losses: number
  winRate: number
  rank: number
  bonusLabels?: { label: string; text: string }[]
}

export function DuoShowcaseCard({
  playerA,
  playerB,
  label,
  labelText,
  wins,
  losses,
  winRate,
  rank,
  bonusLabels,
}: DuoShowcaseCardProps) {
  const isFirst = rank === 1

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-4 rounded-xl border p-6 text-center",
        "bg-[var(--color-navy-light)]",
        isFirst
          ? "border-[var(--color-gold)] shadow-[0_0_30px_rgba(201,169,80,0.3)]"
          : "border-[var(--color-gold)]/20"
      )}
    >
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-navy)] px-3 py-0.5 text-xs font-bold text-[var(--color-gold)]">
        #{rank}
      </div>

      <div className="mt-2 flex items-center gap-3">
        <span className="text-lg font-bold text-[var(--color-gold-light)]">
          {playerA}
        </span>
        <span className="text-sm text-[var(--color-gold)]/50">&</span>
        <span className="text-lg font-bold text-[var(--color-gold-light)]">
          {playerB}
        </span>
      </div>

      <div className="space-y-1">
        <p
          className={cn(
            "text-xl font-black tracking-wide",
            isFirst ? "text-2xl text-[var(--color-gold)]" : "text-[var(--color-gold)]"
          )}
        >
          {label}
        </p>
        <p className="text-sm text-[var(--color-gold-light)]/70">{labelText}</p>
      </div>

      {bonusLabels && bonusLabels.length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {bonusLabels.map((bl) => (
            <span
              key={bl.label}
              className="rounded-full bg-[var(--color-gold)]/10 px-2.5 py-0.5 text-xs font-semibold text-[var(--color-gold)]"
              title={bl.text}
            >
              {bl.label}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-sm">
        <span className="text-green-400">{wins}W</span>
        <span className="text-red-400">{losses}L</span>
      </div>

      <div className="w-full space-y-1">
        <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--color-navy)]">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              winRate >= 50 ? "bg-green-500" : "bg-red-500"
            )}
            style={{ width: `${Math.min(winRate, 100)}%` }}
          />
        </div>
        <p
          className={cn(
            "text-sm font-semibold",
            winRate >= 50 ? "text-green-400" : "text-red-400"
          )}
        >
          {winRate}% WR
        </p>
      </div>
    </div>
  )
}
