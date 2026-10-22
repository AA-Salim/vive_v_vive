import {
  ChartColumnIcon,
  ContactRoundIcon,
  CrosshairIcon,
  CrownIcon,
  DicesIcon,
  HistoryIcon,
  LibraryIcon,
  ShieldIcon,
  StoreIcon,
  SwordsIcon,
  UsersRoundIcon,
  type LucideIcon,
} from "lucide-react"
import type { SessionStatus } from "@/lib/types"

export interface NavLink {
  href: string
  label: string
  short: string
  description: string
  icon: LucideIcon
}

export interface NavGroup {
  id: "play" | "court" | "stats"
  label: string
  blurb: string
  links: NavLink[]
}

export const PLAY_LINK: NavLink = {
  href: "/",
  label: "Play",
  short: "Play",
  description: "The match room. Draft, decree, wager, declare.",
  icon: SwordsIcon,
}

export const NAV_GROUPS: NavGroup[] = [
  { id: "play", label: "Play", blurb: "The Rift", links: [PLAY_LINK] },
  {
    id: "court",
    label: "Court",
    blurb: "Purses, titles and the King's ledger",
    links: [
      { href: "/players", label: "Players", short: "Players", description: "Every noble, their record and the titles they wear.", icon: ContactRoundIcon },
      { href: "/leaderboard", label: "Leaderboard", short: "Ranks", description: "Who holds the purse. Who holds the debt.", icon: CrownIcon },
      { href: "/titles", label: "Titles Shop", short: "Shop", description: "Buy, renew and combo titles. Curses and the going rate for dignity.", icon: StoreIcon },
      { href: "/gamba", label: "Gamba", short: "Gamba", description: "The Gambling Hall. Glory, or a page in the notebook.", icon: DicesIcon },
      { href: "/archives", label: "Archives", short: "Archives", description: "Past acts, sealed in wax. The Reign included.", icon: LibraryIcon },
    ],
  },
  {
    id: "stats",
    label: "Stats",
    blurb: "Cold numbers, warm grudges",
    links: [
      { href: "/history", label: "History", short: "History", description: "Every game. Every delayed victory.", icon: HistoryIcon },
      { href: "/stats", label: "Stats", short: "Stats", description: "Win rates, lanes and other cold truths.", icon: ChartColumnIcon },
      { href: "/rivalries", label: "Rivalries", short: "Rivals", description: "Head to head. Grudges included.", icon: CrosshairIcon },
      { href: "/duos", label: "Duos", short: "Duos", description: "The pairs that carry, and the pairs that int.", icon: UsersRoundIcon },
      { href: "/champions", label: "Champions", short: "Champs", description: "The champion pool, lane by lane.", icon: ShieldIcon },
    ],
  },
]

export const ALL_LINKS: NavLink[] = NAV_GROUPS.flatMap((group) => group.links)

const linkByHref = new Map(ALL_LINKS.map((link) => [link.href, link]))

export function navLink(href: string): NavLink {
  const link = linkByHref.get(href)
  if (!link) throw new Error(`Unknown nav link ${href}`)
  return link
}

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function groupIsActive(pathname: string, group: NavGroup): boolean {
  return group.links.some((link) => isActivePath(pathname, link.href))
}

const PHASE_LABELS: Partial<Record<SessionStatus, string>> = {
  coach_draft: "Coach draft",
  draft: "Draft",
  chaos: "Decrees",
  betting: "Bets open",
  in_game: "In game",
}

export function livePhaseLabel(status: SessionStatus | null | undefined): string | null {
  return status ? (PHASE_LABELS[status] ?? null) : null
}
