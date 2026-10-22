"use client"

import Link from "next/link"
import { ArrowRight, Skull, Sparkles, Zap } from "lucide-react"
import { TitleBadge } from "@/components/title-badge"
import { curseHelp, loadoutHelp, loadoutOf } from "@/components/titles/loadout-chips"
import { InfoTip } from "@/components/ui/info-tip"
import type { RoomPhase } from "@/components/session/copy"
import { useMyTitleEffects } from "@/hooks/use-title-effects"
import { comboLines } from "@/lib/titles/effects"
import { USER_PERK_CAP } from "@/lib/titles/rules"
import type { RoomSession } from "@/lib/session/types"
import type { HelpEntry } from "@/lib/help"
import type { TitleRarity } from "@/lib/titles/types"
import { cn } from "@/lib/utils"

const SHOWN: ReadonlySet<RoomPhase> = new Set(["coach_draft", "draft", "chaos", "betting", "in_game"])

const COMBO_HELP: HelpEntry = {
  title: "Your titles this game",
  does: "Immediate effects change what your decrees, bets, praise, stipend and duels cost or pay the moment you act. Perks pay after the game.",
  cost: "Already paid: titles are bought in the Hall of Titles and sealed while a game is live",
  reward: `Every perk you wear together pays at most ${USER_PERK_CAP} points a game`,
  limits: "Several titles feeding one effect stack up to that effect's cap. Curses always apply while they burn.",
}

interface Item {
  key: string
  name: string
  category: string
  rarity: TitleRarity
  effect: string | null
  perk: string | null
  help: HelpEntry
  cursed: boolean
}

interface LoadoutStripProps {
  session: RoomSession
  phase: RoomPhase
  playerId: string | null
}

// "Your titles this game": for a seated player, every title and curse acting on them, with its bubble.
export function LoadoutStrip({ session, phase, playerId }: LoadoutStripProps) {
  const { entry, fx } = useMyTitleEffects()
  const seated = !!playerId && session.session_assignments.some((a) => a.player_id === playerId)
  if (!seated || !SHOWN.has(phase)) return null

  const items: Item[] = [
    ...(entry ? loadoutOf(entry) : []).map((t) => ({
      key: `t:${t.title}`,
      name: t.title,
      category: t.category,
      rarity: t.rarity,
      effect: t.effect,
      perk: t.perk,
      help: loadoutHelp(t),
      cursed: false,
    })),
    ...(entry?.curses ?? []).map((c) => ({
      key: `c:${c.title}`,
      name: c.title,
      category: "mockery",
      rarity: "cursed" as const,
      effect: c.effect ?? null,
      perk: c.perk || null,
      help: curseHelp(c),
      cursed: true,
    })),
  ]
  const combo = comboLines(fx)

  return (
    <section
      aria-label="Your titles this game"
      className="rounded-xl border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)]/80 px-3 py-2.5"
    >
      <header className="flex items-center gap-2">
        <Zap aria-hidden className="size-4 shrink-0 text-[var(--color-gold)]" />
        <h2 className="text-[10px] font-bold tracking-[0.18em] text-[var(--color-gold)]/80 uppercase">Your titles this game</h2>
        <InfoTip help={COMBO_HELP} className="-my-1" />
        {combo.length > 0 && (
          <p className="ml-auto hidden min-w-0 truncate text-[11px] text-[var(--color-gold-light)]/80 md:block">
            {combo.map((line) => line.chip).join(" · ")}
          </p>
        )}
      </header>

      {items.length === 0 ? (
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          No title or curse acts on you this game.
          <Link href="/titles" className="inline-flex h-8 items-center gap-1 font-medium text-[var(--color-gold)] hover:underline">
            Visit the Hall of Titles
            <ArrowRight aria-hidden className="size-3.5" />
          </Link>
        </p>
      ) : (
        <>
          {combo.length > 0 && (
            <p className="mt-1 text-[11px] leading-snug text-[var(--color-gold-light)]/80 md:hidden">
              {combo.map((line) => line.chip).join(" · ")}
            </p>
          )}
          <ul className="-mx-1 mt-2 flex snap-x gap-2 overflow-x-auto px-1 pb-1 md:flex-wrap md:overflow-visible">
            {items.map((item) => (
              <li
                key={item.key}
                className={cn(
                  "flex w-60 shrink-0 snap-start flex-col gap-1 rounded-lg border p-2 md:w-auto md:max-w-xs md:min-w-52 md:flex-1",
                  item.cursed ? "border-rose-500/30 bg-rose-500/[0.06]" : "border-border bg-[var(--color-navy)]/60"
                )}
              >
                <div className="flex items-center justify-between gap-1.5">
                  <span className="inline-flex min-w-0 [&>span]:truncate">
                    <TitleBadge name={item.name} category={item.category} rarity={item.rarity} />
                  </span>
                  <InfoTip help={item.help} />
                </div>
                <p
                  className={cn(
                    "flex gap-1.5 text-[11px] leading-snug",
                    item.cursed ? "text-rose-100/90" : "text-[var(--color-gold-light)]/90"
                  )}
                >
                  <Zap aria-hidden className={cn("mt-px size-3 shrink-0", item.cursed ? "text-rose-400" : "text-[var(--color-gold)]")} />
                  <span>
                    <span className="sr-only">Now: </span>
                    {item.effect ?? "No immediate effect."}
                  </span>
                </p>
                {item.perk && (
                  <p className="flex gap-1.5 text-[11px] leading-snug text-muted-foreground">
                    {item.cursed ? (
                      <Skull aria-hidden className="mt-px size-3 shrink-0 text-rose-400" />
                    ) : (
                      <Sparkles aria-hidden className="mt-px size-3 shrink-0 text-[var(--color-gold)]" />
                    )}
                    <span>
                      <span className="sr-only">After the game: </span>
                      {item.perk}
                    </span>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
