import { Coins } from "lucide-react"
import { cn } from "@/lib/utils"
import { TIER_LABEL, formatPrice, type PriceTier } from "@/lib/titles/pricing"
import { RARITY_BADGE } from "@/components/titles/title-visuals"

interface TierChipProps {
  tier: PriceTier
  // Omit to show the tier alone; 0 reads "Free".
  price?: number | null
  cursed?: boolean
  size?: "sm" | "md"
  className?: string
}

const SIZES = {
  sm: "h-5 gap-1 px-1.5 text-[10px] [&_svg]:size-3",
  md: "h-7 gap-1.5 px-2 text-xs [&_svg]:size-3.5",
}

// "Legendary · 1,500": the tier sets the price, the slot and the frame.
export function TierChip({ tier, price, cursed = false, size = "md", className }: TierChipProps) {
  const label = TIER_LABEL[tier]
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border font-bold whitespace-nowrap tabular-nums",
        RARITY_BADGE[tier],
        cursed && "border-dashed",
        SIZES[size],
        className
      )}
    >
      {price != null && <Coins aria-hidden />}
      <span>
        {label}
        {price != null ? <span className="font-semibold"> · {price > 0 ? formatPrice(price) : "Free"}</span> : null}
      </span>
      {price != null && price > 0 ? <span className="sr-only"> points</span> : null}
    </span>
  )
}
