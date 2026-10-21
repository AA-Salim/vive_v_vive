import {
  ArrowLeftRightIcon,
  BanIcon,
  DicesIcon,
  FlameIcon,
  FootprintsIcon,
  HandCoinsIcon,
  ShieldCheckIcon,
  ShuffleIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react"
import type { DecreeType } from "@/lib/chaos/catalog"

const ICONS: Record<DecreeType, LucideIcon> = {
  double_or_nothing: HandCoinsIcon,
  royal_pardon: ShieldCheckIcon,
  reroll_self: SparklesIcon,
  champion_ban: BanIcon,
  swap_teammate: ArrowLeftRightIcon,
  lane_force: FootprintsIcon,
  shuffle_lanes: ShuffleIcon,
  reroll_champs: FlameIcon,
  target_reroll: DicesIcon,
}

export function DecreeIcon({ type, className }: { type: DecreeType; className?: string }) {
  const Icon = ICONS[type] ?? DicesIcon
  return <Icon aria-hidden className={className} />
}
