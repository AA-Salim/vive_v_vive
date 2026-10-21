import { CrownIcon, FlameIcon, HourglassIcon, UserRoundIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { PraiseVerdict } from "@/lib/praise/types"
import { cn } from "@/lib/utils"

interface VerdictChipProps {
  verdict: PraiseVerdict | null
  favor: number
  selfPraise?: boolean
  className?: string
}

export function VerdictChip({ verdict, favor, selfPraise, className }: VerdictChipProps) {
  if (verdict === "crowned") {
    return (
      <Badge
        className={cn(
          "border-[var(--color-gold)]/40 bg-[var(--color-gold)]/15 text-[var(--color-gold)]",
          className
        )}
      >
        <CrownIcon aria-hidden />
        Crowned{favor > 0 ? ` +${favor}` : ""}
      </Badge>
    )
  }
  if (verdict === "scorned") {
    return (
      <Badge variant="destructive" className={className}>
        <FlameIcon aria-hidden />
        Scorned
      </Badge>
    )
  }
  if (selfPraise) {
    return (
      <Badge variant="outline" className={cn("text-muted-foreground", className)}>
        <UserRoundIcon aria-hidden />
        Self-praise
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className={cn("text-muted-foreground", className)}>
      <HourglassIcon aria-hidden />
      Awaiting verdict
    </Badge>
  )
}
