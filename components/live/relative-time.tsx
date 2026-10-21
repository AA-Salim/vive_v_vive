"use client"

import { useLiveNow } from "@/hooks/use-live-now"

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })
const fullDate = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" })

export function formatRelative(at: number, now: number): string {
  if (!now) return ""
  const seconds = Math.max(0, Math.round((now - at) / 1000))
  if (seconds < 10) return "now"
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return shortDate.format(at)
}

interface RelativeTimeProps {
  at: string | number
  // Milliseconds the local clock runs ahead of the server (serverTimeDelta), so server timestamps read right.
  offset?: number
  // "just now" / "5m ago" instead of the compact "now" / "5m".
  phrase?: boolean
  className?: string
}

export function RelativeTime({ at, offset = 0, phrase = false, className }: RelativeTimeProps) {
  const now = useLiveNow()
  const time = typeof at === "number" ? at : Date.parse(at)
  if (Number.isNaN(time)) return null
  const label = formatRelative(time, now ? now - offset : 0)
  const text = !phrase || !label ? label : label === "now" ? "just now" : /\d[smhd]$/.test(label) ? `${label} ago` : `on ${label}`
  return (
    <time dateTime={new Date(time).toISOString()} title={fullDate.format(time)} className={className} suppressHydrationWarning>
      {text}
    </time>
  )
}
