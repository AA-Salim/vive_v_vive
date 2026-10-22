"use client"

import { useState } from "react"
import Link from "next/link"
import { HistoryIcon, ScrollTextIcon, SwordsIcon, UsersRoundIcon } from "lucide-react"
import { plural } from "@/components/pages/format"
import { PageEmpty, PageError, SectionCard } from "@/components/pages/states"
import {
  BondList,
  BountyBanner,
  ChampionStrip,
  FormLine,
  GameCard,
  IdentityBlock,
  LaneBreakdown,
  RivalCards,
  StatGrid,
} from "@/components/profile/profile-parts"
import { SeasonPicker, shortActName } from "@/components/profile/season-picker"
import { LoadoutPanel } from "@/components/profile/loadout-panel"
import { TitleEpithet } from "@/components/profile/title-loadout"
import { ProfileApiError, usePlayerProfile, type ProfileScope } from "@/components/profile/use-player-profile"
import { buttonVariants } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEquippedTitles } from "@/hooks/use-equipped-titles"
import { PROFILE_HELP } from "@/lib/profiles/help"
import type { PlayerProfileResponse, ProfileSeason } from "@/lib/profiles/types"
import { cn } from "@/lib/utils"

const TABS = [
  { value: "overview", label: "Overview", icon: ScrollTextIcon },
  { value: "games", label: "Games", icon: SwordsIcon },
  { value: "rivals", label: "Rivals", icon: UsersRoundIcon },
] as const

function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Unsealing the court file">
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-10 w-full rounded-lg sm:w-96" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  )
}

function NoGames({ profile, season }: { profile: PlayerProfileResponse; season: ProfileSeason }) {
  return (
    <PageEmpty icon={SwordsIcon} title={season.key === "all" ? "Not a single game" : `Quiet in ${shortActName(season)}`}>
      {season.key === "all"
        ? `${profile.player.name} has not set foot on the Rift yet. The file opens with the first game.`
        : `${profile.player.name} has no games in ${shortActName(season)}. Try another season, or drag him into the lobby.`}
    </PageEmpty>
  )
}

function Overview({ profile }: { profile: PlayerProfileResponse }) {
  const played = profile.record.games > 0
  return (
    <div className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <StatGrid profile={profile} />
        {played ? (
          <SectionCard title="Lanes" eyebrow="Where the dice sent him">
            <FormLine profile={profile} className="mb-3" />
            <LaneBreakdown lanes={profile.lanes} />
          </SectionCard>
        ) : null}
      </div>
      {played ? (
        <>
          <SectionCard
            title="Champions"
            eyebrow="The dice keep giving him"
            description={`${plural(profile.uniqueChampions, "different champion")} this season. Top ${profile.champions.length} by games.`}
          >
            <ChampionStrip champions={profile.champions} />
          </SectionCard>
          <SectionCard title="Bonds and grudges" eyebrow="Soulmate and arch-nemesis" action={<InfoTip help={PROFILE_HELP.duo} align="end" />}>
            <RivalCards rivals={profile.rivals} />
          </SectionCard>
        </>
      ) : (
        <NoGames profile={profile} season={profile.scope} />
      )}
    </div>
  )
}

function Games({ profile }: { profile: PlayerProfileResponse }) {
  if (profile.recent.length === 0) return <NoGames profile={profile} season={profile.scope} />
  return (
    <SectionCard
      title={`Last ${profile.recent.length} games`}
      eyebrow={shortActName(profile.scope)}
      description="Newest first. Tap any name to open their file."
      action={
        <Link href={`/history?player=${profile.player.id}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
          <HistoryIcon aria-hidden />
          Every game
        </Link>
      }
    >
      <ol className="grid gap-3 md:grid-cols-2">
        {profile.recent.map((game) => (
          <GameCard key={game.gameId} game={game} />
        ))}
      </ol>
    </SectionCard>
  )
}

function Rivals({ profile }: { profile: PlayerProfileResponse }) {
  if (profile.record.games === 0) return <NoGames profile={profile} season={profile.scope} />
  const { rivals } = profile
  return (
    <div className="space-y-4">
      <SectionCard title="Bonds and grudges" eyebrow={shortActName(profile.scope)} action={<InfoTip help={PROFILE_HELP.duo} align="end" />}>
        <RivalCards rivals={rivals} full />
      </SectionCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Brothers in arms" eyebrow="Most games together" description="Record and win rate when on the same side.">
          <BondList bonds={rivals.partners} versus={false} />
        </SectionCard>
        <SectionCard title="Usual suspects" eyebrow="Most games against" description="His record against them, head to head.">
          <BondList bonds={rivals.foes} versus />
        </SectionCard>
      </div>
    </div>
  )
}

interface PlayerProfilePageProps {
  player: string
  initialScope: ProfileScope
}

export function PlayerProfilePage({ player, initialScope }: PlayerProfilePageProps) {
  const [scope, setScope] = useState<ProfileScope>(initialScope)
  const [tab, setTab] = useState<string>("overview")
  const query = usePlayerProfile(player, scope)
  const profile = query.data
  const { entryFor } = useEquippedTitles()

  const changeScope = (next: ProfileScope) => {
    setScope(next)
    const url = new URL(window.location.href)
    if (next === "current") url.searchParams.delete("act")
    else url.searchParams.set("act", String(next))
    window.history.replaceState(null, "", url)
  }

  if (!profile) {
    if (query.isPending) return <PageSkeleton />
    const missing = query.error instanceof ProfileApiError && query.error.status === 404
    return missing ? (
      <PageEmpty
        title="Not in the royal register"
        action={
          <Link href="/players" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Browse the players
          </Link>
        }
      >
        {query.error?.message ?? "The court has no file under that name."} Perhaps a spy.
      </PageEmpty>
    ) : (
      <PageError
        title="This file is sealed"
        message={query.error?.message}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    )
  }

  return (
    <div className={cn("mx-auto max-w-6xl space-y-5 transition-opacity", query.isPlaceholderData && "opacity-70")}>
      <section
        aria-label="Identity"
        className="relative overflow-hidden rounded-2xl border border-[var(--color-gold)]/25 bg-card shadow-2xl shadow-black/30"
      >
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/80 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute -top-24 -left-16 h-56 w-80 rounded-full bg-[var(--color-gold)]/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <IdentityBlock
            profile={profile}
            large
            epithet={<TitleEpithet entry={entryFor(profile.player.id, profile.player.userId)} className="mt-0.5" />}
            heading={
              <h1 className="truncate font-display text-3xl leading-tight font-semibold text-[var(--color-gold-light)] sm:text-4xl">
                {profile.player.name}
              </h1>
            }
          />
          <div className="flex min-w-0 flex-col gap-1.5 lg:items-end">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-muted-foreground uppercase">Season</p>
            <SeasonPicker seasons={profile.seasons} scope={scope} onChange={changeScope} />
          </div>
        </div>
        {profile.bounty ? (
          <div className="relative px-4 pb-4 sm:px-6">
            <BountyBanner bounty={profile.bounty} name={profile.player.name} />
          </div>
        ) : null}
        <LoadoutPanel
          userId={profile.player.userId}
          name={profile.player.name}
          className="relative border-t border-[var(--color-gold)]/12 bg-[var(--color-navy)]/30 p-4 sm:p-6"
        />
      </section>

      <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
        <TabsList className="grid h-11 w-full grid-cols-3 sm:inline-grid sm:w-auto">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="h-full min-w-0 px-2 sm:px-4">
              <Icon aria-hidden className="hidden sm:block" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview" className="pt-2">
          <Overview profile={profile} />
        </TabsContent>
        <TabsContent value="games" className="pt-2">
          <Games profile={profile} />
        </TabsContent>
        <TabsContent value="rivals" className="pt-2">
          <Rivals profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
