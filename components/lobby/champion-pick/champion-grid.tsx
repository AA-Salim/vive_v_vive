"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { CheckIcon, FlameIcon, PinIcon, RotateCcwIcon, SearchIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { LaneIcon } from "@/components/lane-icon"
import { ChampionArt } from "@/components/lobby/champion-pick/champion-art"
import { CHAMPION_HELP } from "@/components/lobby/champion-pick/help"
import { ROLE_LABELS } from "@/lib/champions"
import { LANE_ORDER, championBlock, searchKey, type CatalogChampion, type ChampionBlock, type ChampionPickView } from "@/lib/lobby/champion-pick"
import type { Role } from "@/lib/types"
import { cn } from "@/lib/utils"

type LaneFilter = Role | "all"

interface ChampionGridProps {
  catalog: CatalogChampion[] | undefined
  loading: boolean
  failed: boolean
  onRetry: () => void
  lane: Role | null
  picks: ChampionPickView[]
  fearless: ReadonlySet<string>
  selected: string | null
  interactive: boolean
  wishes: Map<string, string[]>
  nameOf: (playerId: string) => string
  onSelect: (champion: CatalogChampion) => void
}

function blockLabel(block: ChampionBlock, nameOf: (playerId: string) => string): { short: string; long: string } {
  if (block.reason === "fearless") return { short: "Fearless", long: "Fearless: already played today" }
  const side = block.pick.side === "blue" ? "Blue" : "Red"
  return { short: `${side} pick`, long: `Picked by ${side} for ${nameOf(block.pick.player_id)}` }
}

function Tile({
  champion,
  block,
  selected,
  interactive,
  wishedBy,
  nameOf,
  onSelect,
}: {
  champion: CatalogChampion
  block: ChampionBlock | null
  selected: boolean
  interactive: boolean
  wishedBy: string[] | undefined
  nameOf: (playerId: string) => string
  onSelect: (champion: CatalogChampion) => void
}) {
  const label = block ? blockLabel(block, nameOf) : null
  const wish = wishedBy && wishedBy.length > 0 ? `${wishedBy.join(", ")} asked for it` : null
  return (
    <li className="min-w-0">
      <button
        type="button"
        disabled={!interactive || !!block}
        aria-pressed={interactive && !block ? selected : undefined}
        aria-label={[champion.name, label ? `unavailable, ${label.long}` : null, wish].filter(Boolean).join(". ")}
        title={label?.long ?? wish ?? champion.name}
        onClick={() => onSelect(champion)}
        className={cn(
          "group flex w-full min-w-0 flex-col items-center gap-1 rounded-lg p-1 outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
          interactive && !block && "cursor-pointer hover:bg-muted/50",
          (!interactive || block) && "cursor-default",
          selected && "bg-[var(--color-gold)]/12"
        )}
      >
        <span
          className={cn(
            "relative block aspect-square w-full overflow-hidden rounded-md ring-1 transition-shadow",
            selected ? "ring-2 ring-[var(--color-gold)] shadow-[0_0_18px_-4px_var(--color-gold)]" : "ring-border",
            interactive && !block && !selected && "group-hover:ring-[var(--color-gold)]/60"
          )}
        >
          <ChampionArt internal={champion.internal} name={champion.name} decorative className={cn(block && "opacity-35 grayscale")} />
          {label && (
            <span
              className={cn(
                "absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-[var(--color-obsidian)]/80 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                block?.reason === "fearless"
                  ? "text-[var(--color-warning)]"
                  : block?.reason === "taken" && block.pick.side === "blue"
                    ? "text-[var(--color-blue-team)]"
                    : "text-[var(--color-red-team)]"
              )}
              aria-hidden
            >
              {block?.reason === "fearless" && <FlameIcon className="size-2.5" />}
              {label.short}
            </span>
          )}
          {wish && !block && (
            <span className="absolute top-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--color-navy)] text-[var(--color-gold)] ring-1 ring-[var(--color-gold)]/70" aria-hidden>
              <PinIcon className="size-2.5" />
            </span>
          )}
          {selected && (
            <span className="absolute top-0.5 left-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--color-gold)] text-[var(--color-navy)]" aria-hidden>
              <CheckIcon className="size-3" strokeWidth={3} />
            </span>
          )}
        </span>
        <span className={cn("w-full truncate text-center text-[11px] leading-tight", block ? "text-muted-foreground/60" : "text-[var(--color-gold-light)]")}>
          {champion.name}
        </span>
      </button>
    </li>
  )
}

export function ChampionGrid({ catalog, loading, failed, onRetry, lane, picks, fearless, selected, interactive, wishes, nameOf, onSelect }: ChampionGridProps) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<LaneFilter>("all")
  const deferredQuery = useDeferredValue(query)

  const sections = useMemo(() => {
    const needle = searchKey(deferredQuery)
    const matches = (catalog ?? []).filter(
      (c) => (filter === "all" || c.roles.includes(filter)) && (!needle || searchKey(c.name).includes(needle))
    )
    if (filter !== "all" || !lane) return [{ id: "all", title: null as string | null, champions: matches }]
    return [
      { id: "pool", title: `${ROLE_LABELS[lane]} pool`, champions: matches.filter((c) => c.roles.includes(lane)) },
      { id: "rest", title: "Every other champion", champions: matches.filter((c) => !c.roles.includes(lane)) },
    ].filter((s) => s.champions.length > 0)
  }, [catalog, deferredQuery, filter, lane])
  const total = sections.reduce((n, s) => n + s.champions.length, 0)

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            inputMode="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search champions"
            aria-label="Search champions"
            className="h-10 pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear the search"
              className="absolute top-1/2 right-0.5 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <XIcon className="size-4" aria-hidden />
            </button>
          )}
        </div>
        <InfoTip help={CHAMPION_HELP.pool} align="end" />
      </div>

      <div role="group" aria-label="Filter by lane" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]">
        {(["all", ...LANE_ORDER] as LaneFilter[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border px-3 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-[var(--color-gold)]/60 aria-pressed:bg-[var(--color-gold)]/10 aria-pressed:text-[var(--color-gold)]"
          >
            {value === "all" ? "All" : <LaneIcon lane={value} size={14} title={null} />}
            {value !== "all" && <span className={cn(value !== lane && "max-sm:sr-only")}>{ROLE_LABELS[value]}</span>}
          </button>
        ))}
      </div>

      <div className="max-h-[min(30rem,58dvh)] overflow-y-auto overscroll-contain rounded-xl border border-border/70 bg-[var(--color-surface-sunken)]/60 p-1.5 [scrollbar-width:thin]">
        {loading ? (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1.5" aria-busy="true" aria-label="Loading champions">
            {Array.from({ length: 18 }, (_, i) => (
              <li key={i} className="flex flex-col items-center gap-1 p-1">
                <Skeleton className="aspect-square w-full rounded-md" />
                <Skeleton className="h-2.5 w-3/4" />
              </li>
            ))}
          </ul>
        ) : failed && !catalog ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground">
            The champion scroll is unreadable right now.
            <Button variant="outline" className="h-10" onClick={onRetry}>
              <RotateCcwIcon aria-hidden />
              Try again
            </Button>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-muted-foreground">
            {query ? `No champion matches "${query}".` : "No champion plays that lane."}
            <Button
              variant="ghost"
              className="h-10"
              onClick={() => {
                setQuery("")
                setFilter("all")
              }}
            >
              Show every champion
            </Button>
          </div>
        ) : (
          sections.map((section) => (
            <section key={section.id} aria-label={section.title ?? "Champions"}>
              {section.title && (
                <h4 className="sticky -top-1.5 z-[1] -mx-1.5 bg-[var(--color-surface-sunken)]/95 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
                  {section.title} · {section.champions.length}
                </h4>
              )}
              <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.25rem,1fr))] gap-1">
                {section.champions.map((champion) => (
                  <Tile
                    key={champion.name}
                    champion={champion}
                    block={championBlock(champion.name, picks, fearless)}
                    selected={selected === champion.name}
                    interactive={interactive}
                    wishedBy={wishes.get(champion.name)}
                    nameOf={nameOf}
                    onSelect={onSelect}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  )
}
