"use client"

import type { LucideIcon } from "lucide-react"
import { DuoBadgeChip } from "@/components/duo-list"
import { PlayerAvatar } from "@/components/pages/avatars"
import { WinRateMeter } from "@/components/pages/indicators"
import type { Duo, DuoBadge, PlayerRef } from "@/lib/pages/types"

const partnerOf = (duo: Duo, playerId: string) => (duo.a === playerId ? duo.b : duo.a)

interface PartnerColumnProps {
  title: string
  icon: LucideIcon
  duos: Duo[]
  playerId: string
  players: Map<string, PlayerRef>
  onOpen: (duo: Duo) => void
  empty: string
}

export function PartnerColumn({ title, icon: Icon, duos, playerId, players, onOpen, empty }: PartnerColumnProps) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
        <Icon className="size-3.5 text-[var(--color-gold)]/70" aria-hidden />
        {title}
      </h3>
      {duos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1.5">
          {duos.map((duo) => {
            const mate = players.get(partnerOf(duo, playerId))
            if (!mate) return null
            return (
              <li key={mate.id}>
                <button
                  type="button"
                  onClick={() => onOpen(duo)}
                  className="flex w-full items-center gap-2.5 rounded-xl bg-[var(--color-navy)]/50 px-2.5 py-2 text-left outline-none hover:bg-[var(--color-navy)]/80 focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <PlayerAvatar name={mate.name} src={mate.avatarUrl} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--color-gold-light)]">{mate.name}</span>
                    <span className="block text-[11px] text-muted-foreground tabular-nums">
                      {duo.wins}W {duo.losses}L together
                    </span>
                  </span>
                  <WinRateMeter rate={duo.winRate} games={duo.games} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

interface DuoHonorsProps {
  honors: { duo: Duo; badge: DuoBadge }[]
  players: Map<string, PlayerRef>
  onOpen: (duo: Duo) => void
}

export function DuoHonors({ honors, players, onOpen }: DuoHonorsProps) {
  if (honors.length === 0) return null
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Duo honors">
      {honors.map(({ duo, badge }) => {
        const a = players.get(duo.a)
        const b = players.get(duo.b)
        if (!a || !b) return null
        return (
          <li key={badge.id}>
            <button
              type="button"
              onClick={() => onOpen(duo)}
              className="flex h-full w-full flex-col gap-2 rounded-xl border border-[var(--color-gold)]/15 bg-card p-3 text-left outline-none hover:border-[var(--color-gold)]/35 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <DuoBadgeChip badge={badge} className="self-start" />
              <span className="flex items-center gap-2">
                <span className="flex shrink-0 -space-x-2">
                  <PlayerAvatar name={a.name} src={a.avatarUrl} size="xs" className="ring-2 ring-card" />
                  <PlayerAvatar name={b.name} src={b.avatarUrl} size="xs" className="ring-2 ring-card" />
                </span>
                <span className="truncate text-xs font-semibold text-[var(--color-gold-light)]">
                  {a.name} &amp; {b.name}
                </span>
              </span>
              <span className="text-[11px] leading-snug text-muted-foreground">{badge.text}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
