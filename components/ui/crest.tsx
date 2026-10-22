import { useId, type SVGProps } from "react"

import { cn } from "@/lib/utils"

// The court's emblem: a hextech frame around the crown. Same drawing as app/icon.svg.
function Crest({ className, title, ...props }: SVGProps<SVGSVGElement> & { title?: string }) {
  const id = useId()
  const gold = `${id}-gold`
  const fill = `${id}-fill`
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("size-8 shrink-0", className)}
      {...props}
    >
      {title && <title>{title}</title>}
      <defs>
        <linearGradient id={gold} x1="32" y1="4" x2="32" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--color-gold-light)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--color-gold-bright)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-gold-dark)" }} />
        </linearGradient>
        <linearGradient id={fill} x1="32" y1="6" x2="32" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--color-navy-lighter)" }} />
          <stop offset="1" style={{ stopColor: "var(--color-obsidian)" }} />
        </linearGradient>
      </defs>
      <path d="M32 4 56 17.5v29L32 60 8 46.5v-29Z" fill={`url(#${fill})`} stroke={`url(#${gold})`} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M32 11.5 49.5 21.25v21.5L32 52.5 14.5 42.75v-21.5Z" stroke={`url(#${gold})`} strokeOpacity="0.35" strokeWidth="1" strokeLinejoin="round" />
      <path d="M19 25.5 25.5 31 32 20l6.5 11 6.5-5.5-2.75 13.5H21.75Z" fill={`url(#${gold})`} strokeLinejoin="round" />
      <path d="M22 43.5h20" stroke={`url(#${gold})`} strokeWidth="3" strokeLinecap="round" />
      <circle cx="32" cy="16.5" r="1.75" style={{ fill: "var(--color-gold-light)" }} />
    </svg>
  )
}

export { Crest }
