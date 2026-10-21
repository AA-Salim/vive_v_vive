import { CrownIcon, FlameIcon, ShieldCheckIcon, TrendingUpIcon, ZapIcon } from "lucide-react"
import type { MarketBet } from "@/lib/betting/types"
import { cn } from "@/lib/utils"

const TAG = "inline-flex h-5 items-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold uppercase tracking-wider"

export function BetTags({ bet, compact = false }: { bet: MarketBet; compact?: boolean }) {
  const tags: Array<{ key: string; label: string; icon: typeof ZapIcon; className: string }> = []
  if (bet.whale) tags.push({ key: "whale", label: "Whale", icon: CrownIcon, className: "border-[var(--color-gold)]/50 bg-[var(--color-gold)]/15 text-[var(--color-gold)]" })
  if (bet.all_in) tags.push({ key: "all-in", label: "All-in", icon: FlameIcon, className: "border-[var(--color-red-team)]/50 bg-[var(--color-red-team)]/15 text-[var(--color-red-team)]" })
  if (bet.insured) tags.push({ key: "insured", label: "Insured", icon: ShieldCheckIcon, className: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" })
  if (bet.early_amount > 0) tags.push({ key: "early", label: "Early", icon: ZapIcon, className: "border-[var(--color-gold)]/35 bg-transparent text-[var(--color-gold)]/90" })
  if (bet.raises > 0) tags.push({ key: "raised", label: bet.raises > 1 ? `Raised x${bet.raises}` : "Raised", icon: TrendingUpIcon, className: "border-border bg-transparent text-muted-foreground" })
  if (tags.length === 0) return null

  return (
    <span className="flex flex-wrap items-center gap-1">
      {tags.map(({ key, label, icon: Icon, className }) => (
        <span key={key} className={cn(TAG, className, compact && "px-1")} title={label}>
          <Icon className="size-3" aria-hidden />
          {compact ? <span className="sr-only">{label}</span> : label}
        </span>
      ))}
    </span>
  )
}
