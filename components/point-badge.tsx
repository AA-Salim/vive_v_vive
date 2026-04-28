"use client"

import Link from "next/link"
import { CoinsIcon } from "lucide-react"

interface PointBadgeProps {
  balance: number
}

export function PointBadge({ balance }: PointBadgeProps) {
  return (
    <Link
      href="/profile"
      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-[var(--color-gold)] transition-colors hover:bg-[var(--color-gold)]/10"
    >
      <CoinsIcon className="h-4 w-4" />
      <span className="tabular-nums">{balance}</span>
    </Link>
  )
}
