import type { ReactNode } from "react"
import type { Role } from "@/lib/types"
import { ROLE_LABELS } from "@/lib/champions"
import { cn } from "@/lib/utils"

const CORNER_TOP = "M4 4h12.5L13 7.5H7.5V13L4 16.5z"
const CORNER_BOTTOM = "M20 20H7.5l3.5-3.5h5.5V11l3.5-3.5z"
const CENTER = "M10 10h4v4h-4z"

const ICONS: Record<Role, ReactNode> = {
  top: (
    <>
      <path d={CORNER_TOP} />
      <path d={CENTER} opacity={0.55} />
      <path d={CORNER_BOTTOM} opacity={0.3} />
    </>
  ),
  jungle: (
    <path d="M6.5 3.5c2.9 2.6 4.2 5.9 4 10L12 20.5l1.5-7c-.2-4.1 1.1-7.4 4-10-.5 3.5-1.7 6.4-3.6 8.6L12 15.6l-1.9-3.5C8.2 9.9 7 7 6.5 3.5zM12 3c.9 1.8 1.2 3.6.9 5.5L12 10.4l-.9-1.9C10.8 6.6 11.1 4.8 12 3z" />
  ),
  mid: (
    <>
      <path d="M4 4h7L4 11z" opacity={0.3} />
      <path d="M20 20h-7l7-7z" opacity={0.3} />
      <path d="M16.5 4H20v3.5L7.5 20H4v-3.5z" />
    </>
  ),
  adc: (
    <>
      <path d={CORNER_BOTTOM} />
      <path d={CENTER} opacity={0.55} />
      <path d={CORNER_TOP} opacity={0.3} />
    </>
  ),
  support: (
    <>
      <path d="M12 6l2.8 2.9L12 15.8 9.2 8.9z" />
      <path d="M2.5 6.5h6.4l1.2 2.3-2.6 3.7H5z" opacity={0.85} />
      <path d="M21.5 6.5h-6.4l-1.2 2.3 2.6 3.7H19z" opacity={0.85} />
      <path d="M10.4 17.2h3.2L12 21z" />
    </>
  ),
}

interface LaneIconProps {
  lane: Role
  size?: number
  className?: string
  title?: string | null
}

export function LaneIcon({ lane, size = 16, className, title }: LaneIconProps) {
  const label = title === null ? undefined : title ?? ROLE_LABELS[lane]
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={cn("inline-block shrink-0", className)}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {label && <title>{label}</title>}
      {ICONS[lane]}
    </svg>
  )
}
