import type { LucideIcon } from "lucide-react"
import { InfoTip } from "@/components/ui/info-tip"
import type { HelpEntry } from "@/lib/help"

export interface TotalTile {
  icon: LucideIcon
  label: string
  value: string
  help: HelpEntry
}

// The compact three-up totals under a podium (the treasury, the Hall of Kisses).
export function TotalTiles({ items }: { items: TotalTile[] }) {
  return (
    <dl className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 rounded-xl border border-[var(--color-gold)]/12 bg-card px-2.5 py-2 sm:px-3">
          <dt className="flex items-start gap-1 text-[10px] leading-tight font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <item.icon className="mt-px size-3 shrink-0 text-[var(--color-gold)]/60" aria-hidden />
            <span className="min-w-0 flex-1">{item.label}</span>
            <InfoTip help={item.help} className="-my-1 -mr-1 size-4 before:-inset-3 [&_svg]:size-3.5" />
          </dt>
          <dd className="truncate font-display text-base font-semibold text-[var(--color-gold-light)] tabular-nums sm:text-lg">
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}
