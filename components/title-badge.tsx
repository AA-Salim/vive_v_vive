"use client"

const CATEGORY_COLORS: Record<string, string> = {
  rebellion: "text-red-400 border-red-500/30 bg-red-500/10",
  mockery: "text-purple-400 border-purple-500/30 bg-purple-500/10",
  loyalty: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  absurd: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  award: "text-[var(--color-gold)] border-[var(--color-gold)]/30 bg-[var(--color-gold)]/10",
}

interface TitleBadgeProps {
  name: string
  category?: string
}

export function TitleBadge({ name, category }: TitleBadgeProps) {
  const colors = CATEGORY_COLORS[category ?? ""] ?? CATEGORY_COLORS.absurd

  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold ${colors}`}
    >
      {name}
    </span>
  )
}
