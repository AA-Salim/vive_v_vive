import type { SVGProps } from "react"
import { HandHeart, Skull, Snail, type LucideIcon } from "lucide-react"
import type { MarkKind } from "@/lib/titles/flair"

type IconProps = SVGProps<SVGSVGElement>

function Glyph({ children, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={24}
      height={24}
      {...props}
    >
      {children}
    </svg>
  )
}

export function JesterBells(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M5 18.5h14" />
      <path d="M5 21h14" />
      <path d="M5.5 18.5c0-5 .5-8.5 3.5-11-2.8-.6-5.5.8-6.5 3.5" />
      <path d="M18.5 18.5c0-5-.5-8.5-3.5-11 2.8-.6 5.5.8 6.5 3.5" />
      <path d="M9.5 18.5c0-6 1-11 4-14 1.8 1.4 2.4 3.6 1.8 5.8" />
      <circle cx="2.6" cy="12.2" r="1.3" />
      <circle cx="21.4" cy="12.2" r="1.3" />
      <circle cx="15.3" cy="11.6" r="1.3" />
    </Glyph>
  )
}

export function RoyalBoot(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M8 2.5h6v9.8l4.3 1.7a3 3 0 0 1 1.9 2.8V19H5v-3.5l3-1.2Z" />
      <path d="M5 21.5h15.2" />
      <path d="M8 6.5h6" />
    </Glyph>
  )
}

export function RolledCarpet(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M17.5 8.5H5v8h12.5" />
      <circle cx="17.5" cy="12.5" r="4" />
      <circle cx="17.5" cy="12.5" r="1.2" />
      <path d="M2 10h3M2 12.5h3M2 15h3" />
    </Glyph>
  )
}

export function Laurel(props: IconProps) {
  return (
    <Glyph {...props}>
      <path d="M9 21c-4-2.2-5.8-6.6-4.6-12.5" />
      <path d="M15 21c4-2.2 5.8-6.6 4.6-12.5" />
      <path d="M5.2 16.6 2.6 15.4M4.3 12.8 1.8 11.2M4.6 9 3.4 6.4" />
      <path d="M18.8 16.6l2.6-1.2M19.7 12.8l2.5-1.6M19.4 9l1.2-2.6" />
      <path d="m12 4.5.9 1.8 2 .3-1.4 1.4.3 2-1.8-1-1.8 1 .3-2-1.4-1.4 2-.3Z" />
    </Glyph>
  )
}

export const MARK_ICON: Record<MarkKind, LucideIcon | ((props: IconProps) => React.JSX.Element)> = {
  bells: JesterBells,
  boot: RoyalBoot,
  carpet: RolledCarpet,
  heart: HandHeart,
  snail: Snail,
  skull: Skull,
}

export const MARK_LABEL: Record<MarkKind, string> = {
  bells: "jester bells",
  boot: "the royal boot",
  carpet: "the royal carpet",
  heart: "an emotional support badge",
  snail: "a crawl mark",
  skull: "a brand",
}
