"use client"

import Link from "next/link"
import { ArrowRightIcon, ArrowUpIcon, BadgeCheckIcon } from "lucide-react"
import { PageError } from "@/components/pages/states"
import { TitleBadge } from "@/components/title-badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useTitlesCatalog } from "@/lib/titles/use-titles"
import type { OwnedTitleView, TitleView } from "@/lib/titles/types"

interface OwnedTitle {
  owned: OwnedTitleView
  title: TitleView
}

// The wardrobe: titles owned but not worn. The loadout itself lives in the profile hero.
export function TitlesCard() {
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
  const spare: OwnedTitle[] = data.collection.flatMap((o) => {
    const title = byId.get(o.title_id)
    return title && !o.is_active && !o.curse?.active ? [{ owned: o, title }] : []
  })

  if (data.collection.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <BadgeCheckIcon className="size-6 text-[var(--color-gold)]/60" aria-hidden />
        <p className="text-sm text-muted-foreground">No titles yet. Nobody at court knows what to call you.</p>
        <HallLink />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-1.5 text-xs leading-snug text-muted-foreground">
        <ArrowUpIcon className="mt-px size-3.5 shrink-0 text-[var(--color-gold)]/70" aria-hidden />
        What you wear, and your curses, sit at the top of the page. Edit the loadout there.
      </p>
      {spare.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {spare.map(({ owned: o, title }) => (
            <li key={o.title_id} className="max-w-full">
              <TitleBadge name={title.name} category={title.category} rarity={title.rarity} perk={o.perk} description={title.description} size="md" interactive />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--color-gold)]/20 p-3 text-sm text-muted-foreground">
          Everything you own is already worn. The wardrobe echoes.
        </p>
      )}
      <HallLink />
    </div>
  )
}

function HallLink() {
  return (
    <Link href="/titles" className="inline-flex h-10 items-center gap-1.5 text-sm font-medium text-[var(--color-gold)] hover:underline">
      More titles in the Titles Shop
      <ArrowRightIcon className="size-4" aria-hidden />
    </Link>
  )
}
