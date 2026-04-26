import type { Role } from "@/lib/types"

const icons: Record<Role, { emoji: string; svg: React.ReactNode }> = {
  top: {
    emoji: "⚔️",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
        <path d="M13 19l6-6" />
        <path d="M16 16l4 4" />
        <path d="M19 21l2-2" />
      </svg>
    ),
  },
  jungle: {
    emoji: "🌿",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22V8" />
        <path d="M5 12l7-7 7 7" />
        <path d="M8 16l4-4 4 4" />
      </svg>
    ),
  },
  mid: {
    emoji: "🔮",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="8" />
        <line x1="12" y1="2" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22" />
        <line x1="2" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22" y2="12" />
      </svg>
    ),
  },
  adc: {
    emoji: "🏹",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22l-4-4H4v-4L2 12l2-2V6h4l4-4 4 4h4v4l2 2-2 2v4h-4z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  support: {
    emoji: "🛡️",
    svg: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M12 8v4" />
        <path d="M10 10h4" />
      </svg>
    ),
  },
}

interface LaneIconProps {
  lane: Role
  size?: number
  className?: string
}

export function LaneIcon({ lane, size = 16, className }: LaneIconProps) {
  const icon = icons[lane]
  return (
    <span
      className={className}
      style={{ width: size, height: size, display: "inline-flex" }}
      title={lane.charAt(0).toUpperCase() + lane.slice(1)}
    >
      {icon.svg}
    </span>
  )
}
