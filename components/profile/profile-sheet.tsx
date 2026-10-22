"use client"

import { useState, type ComponentType, type ReactNode } from "react"
import Link from "next/link"
import { ArrowRightIcon, XIcon } from "lucide-react"
import { PageError } from "@/components/pages/states"
import {
  BountyBanner,
  ChampionStrip,
  Eyebrow,
  FormLine,
  GameRow,
  IdentityBlock,
  LaneBreakdown,
  RivalCards,
  StatGrid,
} from "@/components/profile/profile-parts"
import { SeasonPicker, shortActName } from "@/components/profile/season-picker"
import { TitleLoadout } from "@/components/profile/title-loadout"
import { LoadoutSummaryBar } from "@/components/titles/loadout-summary"
import { ProfileApiError, useLiveTitles, usePlayerProfile, type ProfileScope } from "@/components/profile/use-player-profile"
import { useMediaQuery } from "@/components/session/use-browser-state"
import { buttonVariants } from "@/components/ui/button"
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { PROFILE_HELP } from "@/lib/profiles/help"
import { cn } from "@/lib/utils"

type TextSlot = ComponentType<{ className?: string; children?: ReactNode }>

const QUICK_GAMES = 5

function QuickSkeleton({ Title }: { Title: TextSlot }) {
  return (
    <div className="space-y-4" aria-busy="true">
      <Title className="sr-only">Opening the court file</Title>
      <div className="flex items-center gap-3">
        <Skeleton className="size-14 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <Skeleton className="h-40 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  )
}

interface QuickViewProps {
  player: string
  scope: ProfileScope
  onScope: (scope: ProfileScope) => void
  onLeave: () => void
  Title: TextSlot
  Description: TextSlot
}

function QuickView({ player, scope, onScope, onLeave, Title, Description }: QuickViewProps) {
  const query = usePlayerProfile(player, scope)
  const profile = query.data
  const titles = useLiveTitles(profile)

  if (!profile) {
    if (query.isPending) return <QuickSkeleton Title={Title} />
    const missing = query.error instanceof ProfileApiError && query.error.status === 404
    return (
      <div className="space-y-3">
        <Title className="font-display text-xl">{missing ? "No such noble" : "This file is sealed"}</Title>
        <PageError
          title={missing ? "Not in the royal register" : "The scribes dropped the scrolls"}
          message={missing ? "The court has no file under that name. Perhaps a spy." : query.error?.message}
          onRetry={missing ? undefined : () => void query.refetch()}
          retrying={query.isFetching}
          className="py-6"
        />
      </div>
    )
  }

  const { player: who, scope: season } = profile
  const recent = profile.recent.slice(0, QUICK_GAMES)
  const seasonLabel = shortActName(season)

  return (
    <div className={cn("space-y-5 transition-opacity", query.isPlaceholderData && "opacity-60")}>
      <div className="space-y-3">
        <IdentityBlock
          profile={profile}
          className="pr-10"
          heading={<Title className="truncate font-display text-2xl leading-tight font-semibold text-[var(--color-gold-light)]">{who.name}</Title>}
        />
        <Description className="sr-only">Record, banners and rivals of {who.name}</Description>
        <BountyBanner bounty={profile.bounty} name={who.name} />
        <SeasonPicker seasons={profile.seasons} scope={scope} onChange={onScope} compact />
      </div>

      <section className="space-y-2" aria-label="Banner loadout">
        <Eyebrow help={PROFILE_HELP.loadout}>Banner loadout</Eyebrow>
        <LoadoutSummaryBar userId={who.userId} name={who.name} />
        <TitleLoadout titles={titles} linked={!!who.userId} />
      </section>

      <StatGrid profile={profile} />

      {profile.record.games === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--color-gold)]/20 px-4 py-5 text-center text-sm text-muted-foreground">
          {season.key === "all"
            ? `${who.name} has not set foot on the Rift yet. The file opens with the first game.`
            : `No games in ${seasonLabel} yet. The scribes are sharpening their quills.`}
        </p>
      ) : (
        <>
          <FormLine profile={profile} />
          <section className="space-y-2" aria-label="Lanes">
            <Eyebrow>Lanes</Eyebrow>
            <LaneBreakdown lanes={profile.lanes} />
          </section>
          <section className="space-y-2" aria-label="Favourite champions">
            <Eyebrow>The dice keep giving him</Eyebrow>
            <ChampionStrip champions={profile.champions} limit={4} />
          </section>
          <section className="space-y-2" aria-label="Rivals">
            <Eyebrow help={PROFILE_HELP.duo}>Bonds and grudges</Eyebrow>
            <RivalCards rivals={profile.rivals} className="sm:grid-cols-1" />
          </section>
          <section aria-label="Recent games">
            <Eyebrow>Last {recent.length} games</Eyebrow>
            <ol className="divide-y divide-[var(--color-gold)]/8">
              {recent.map((game) => (
                <GameRow key={game.gameId} game={game} />
              ))}
            </ol>
          </section>
        </>
      )}

      <Link
        href={`/players/${who.id}${scope === "current" ? "" : `?act=${scope}`}`}
        onClick={onLeave}
        className={buttonVariants({ variant: "royal", size: "lg", className: "w-full" })}
      >
        Open the full court file
        <ArrowRightIcon aria-hidden />
      </Link>
    </div>
  )
}

interface ProfileSheetProps {
  player: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// The quick profile: a bottom drawer on phones (swipe to dismiss), a side sheet from tablets up.
export function ProfileSheet({ player, open, onOpenChange }: ProfileSheetProps) {
  const desktop = useMediaQuery("(min-width: 768px)")
  const [scope, setScope] = useState<ProfileScope>("current")
  const [scopedFor, setScopedFor] = useState(player)
  if (player !== scopedFor) {
    setScopedFor(player)
    setScope("current")
  }

  const close = () => onOpenChange(false)
  const view = (Title: TextSlot, Description: TextSlot) =>
    player ? <QuickView player={player} scope={scope} onScope={setScope} onLeave={close} Title={Title} Description={Description} /> : null

  if (desktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="gap-0 p-5 pt-6 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
          {view(SheetTitle, SheetDescription)}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerClose
          className="absolute top-2 right-2 z-10 grid size-10 place-items-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Close"
        >
          <XIcon className="size-4" aria-hidden />
        </DrawerClose>
        {view(DrawerTitle, DrawerDescription)}
      </DrawerContent>
    </Drawer>
  )
}
