"use client"

import Link from "next/link"
import { ArrowRightIcon, BadgeCheckIcon, HourglassIcon } from "lucide-react"
import { PageError } from "@/components/pages/states"
import { TitleBadge } from "@/components/title-badge"
import { PerkLine } from "@/components/titles/perk-line"
import { Skeleton } from "@/components/ui/skeleton"
import { useTitlesCatalog } from "@/lib/titles/use-titles"
import { useAuth } from "@/hooks/use-auth"
import { LoadoutSummaryBar } from "@/components/titles/loadout-summary"
import type { OwnedTitleView, TitleView } from "@/lib/titles/types"

interface OwnedTitle {
  owned: OwnedTitleView
  title: TitleView
}

export function TitlesCard() {
  const { user } = useAuth()
  const catalog = useTitlesCatalog()
  const data = catalog.data

  if (catalog.isPending) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Opening your wardrobe">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-6 w-28 rounded-md" />
          ))}
        </div>
      </div>
    )
  }
  if (!data) {
    return (
      <PageError
        title="The Hall of Titles is closed"
        message={catalog.error?.message ?? "Your titles could not be read."}
        onRetry={() => void catalog.refetch()}
        retrying={catalog.isFetching}
        className="py-6"
      />
    )
  }

  const byId = new Map(data.titles.map((t) => [t.id, t]))
  const owned: OwnedTitle[] = data.collection.flatMap((o) => {
    const title = byId.get(o.title_id)
    return title ? [{ owned: o, title }] : []
  })
  const equipped = owned.find((o) => o.owned.is_active)
  const brands = owned.filter((o) => o.owned.curse?.active)
  const others = owned.filter((o) => o !== equipped && !o.owned.curse?.active)

  if (owned.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <BadgeCheckIcon className="size-6 text-[var(--color-gold)]/60" aria-hidden />
        <p className="text-sm text-muted-foreground">No titles yet. Nobody at court knows what to call you.</p>
        <Link href="/titles" className="inline-flex h-10 items-center gap-1.5 text-sm font-medium text-[var(--color-gold)] hover:underline">
          Visit the Hall of Titles
          <ArrowRightIcon className="size-4" aria-hidden />
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <LoadoutSummaryBar userId={user?.id ?? null} />
      {equipped ? (
        <div className="rounded-xl border border-[var(--color-gold)]/30 bg-[var(--color-gold)]/[0.05] p-3">
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">Banner raised</p>
          <TitleBadge
            name={equipped.title.name}
            category={equipped.title.category}
            rarity={equipped.title.rarity}
            perk={equipped.owned.perk}
            description={equipped.title.description}
            size="lg"
          />
          <PerkLine perk={equipped.owned.perk} className="mt-2" />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--color-gold)]/20 p-3 text-sm text-muted-foreground">
          No banner raised. Equip a title to put its perk to work.
        </p>
      )}

      {brands.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-rose-300/80 uppercase">Brands you carry</p>
          <ul className="space-y-1.5">
            {brands.map(({ owned: o, title }) => (
              <li key={o.title_id} className="flex flex-wrap items-center gap-2">
                <TitleBadge
                  name={title.name}
                  category={title.category}
                  rarity="cursed"
                  perk={o.perk}
                  curse={{ bestowedBy: o.bestowed_by?.name ?? null, gamesLeft: o.curse?.left }}
                  size="md"
                />
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <HourglassIcon className="size-3" aria-hidden />
                  {o.curse?.left ?? 0} {o.curse?.left === 1 ? "game" : "games"} left
                  {o.bestowed_by ? ` · from ${o.bestowed_by.name}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {others.length > 0 ? (
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            In the wardrobe · {others.length}
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {others.map(({ owned: o, title }) => (
              <li key={o.title_id} className="max-w-full">
                <TitleBadge name={title.name} category={title.category} rarity={title.rarity} perk={o.perk} description={title.description} size="md" />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Link href="/titles" className="inline-flex h-10 items-center gap-1.5 text-sm font-medium text-[var(--color-gold)] hover:underline">
        Manage titles
        <ArrowRightIcon className="size-4" aria-hidden />
      </Link>
    </div>
  )
}
