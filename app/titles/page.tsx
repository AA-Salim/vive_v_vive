"use client"

import { useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DebtPledgeDialog } from "@/components/debt-pledge-dialog"
import { Armory } from "@/components/titles/armory"
import { BannerPanel } from "@/components/titles/banner-panel"
import { BestowDialog } from "@/components/titles/bestow-dialog"
import { BuyDialog } from "@/components/titles/buy-dialog"
import { CollectionGrid } from "@/components/titles/collection-grid"
import { DignityDialog } from "@/components/titles/dignity-dialog"
import { HallHeader } from "@/components/titles/hall-header"
import { buildLoadout } from "@/components/titles/loadout-model"
import { MilestonesPanel } from "@/components/titles/milestones-panel"
import { useAuth } from "@/hooks/use-auth"
import {
  useBuyTitle,
  useClaimMilestones,
  useLiftCurse,
  useMilestones,
  useSetLoadout,
  useTitleRules,
  useTitlesCatalog,
  useTitlesLockSync,
  useWallet,
} from "@/lib/titles/use-titles"
import type { CourtMember, OwnedTitleView, TitleView } from "@/lib/titles/types"

type HallTab = "armory" | "collection" | "milestones"

const TAB_TRIGGER = "h-10 flex-1 px-3 text-sm data-active:text-[var(--color-gold-light)] sm:flex-none sm:px-5"

export default function TitlesPage() {
  const { user, profile, isLoading: authLoading, signIn } = useAuth()
  const signedIn = !!user
  const catalog = useTitlesCatalog()
  const wallet = useWallet(user?.id ?? null)
  const milestones = useMilestones(signedIn)
  const equip = useSetLoadout()
  const buy = useBuyTitle()
  const lift = useLiftCurse()
  const claim = useClaimMilestones()
  useTitlesLockSync()
  useTitleRules()

  const [tab, setTab] = useState<HallTab>("armory")
  const [buyTarget, setBuyTarget] = useState<TitleView | null>(null)
  const [bestowTarget, setBestowTarget] = useState<TitleView | null>(null)
  const [dignityTarget, setDignityTarget] = useState<{ title: TitleView; owned: OwnedTitleView } | null>(null)
  const [pledged, setPledged] = useState<(() => void) | null>(null)

  const data = catalog.data
  const balance = wallet.data ?? data?.balance ?? null
  const locked = data?.locked ?? false
  const loadout = useMemo(() => buildLoadout(data), [data])
  const me = user ? { id: user.id, name: profile?.players?.name ?? profile?.discord_username ?? "You" } : null
  const busyId = (equip.isPending && equip.variables?.change?.title.id) || (buy.isPending && buy.variables?.titleId) || null
  const claimable = milestones.data?.milestones.filter((m) => m.unlocked && !m.claimed).length ?? 0

  const withPledge = (action: () => void) => {
    if (balance !== null && balance < 0) setPledged(() => action)
    else action()
  }

  const look = (title: TitleView) => ({ category: title.category, rarity: title.rarity, wearer: me?.name ?? null })

  const equipTitle = (title: TitleView) =>
    equip.mutate({ titleIds: loadout.idsWith(title), change: { title, equipped: true, wearer: me?.name ?? null } })
  const unequipTitle = (title: TitleView) => equip.mutate({ titleIds: loadout.idsWithout(title), change: { title, equipped: false } })
  const clearLoadout = () => {
    const lead = loadout.worn[0]?.title
    equip.mutate({ titleIds: [], change: lead ? { title: lead, equipped: false } : undefined })
  }

  const confirmBuy = (title: TitleView, equipNow: boolean) =>
    withPledge(() =>
      buy.mutate(
        {
          titleId: title.id,
          name: title.name,
          title,
          equipWith: equipNow ? loadout.idsWith(title) : undefined,
          ...look(title),
        },
        { onSuccess: () => setBuyTarget(null) }
      )
    )

  const confirmBestow = (title: TitleView, target: CourtMember) =>
    withPledge(() =>
      buy.mutate(
        { titleId: title.id, name: title.name, targetUserId: target.id, targetName: target.name },
        { onSuccess: () => setBestowTarget(null) }
      )
    )

  const confirmDignity = (title: TitleView) =>
    withPledge(() => lift.mutate({ titleId: title.id, name: title.name }, { onSuccess: () => setDignityTarget(null) }))

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <HallHeader balance={signedIn ? balance : null} signedIn={signedIn} prices={data?.titles.map((t) => t.price)} />

      {catalog.error && (
        <Alert variant="destructive">
          <AlertTitle>The Titles Shop is closed for cleaning</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            {catalog.error.message}
            <Button variant="outline" className="h-10 gap-2" onClick={() => catalog.refetch()}>
              <RefreshCw aria-hidden />
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] lg:items-start">
        <aside className="lg:sticky lg:top-6 lg:order-2" aria-label="Your banner and brands">
          <BannerPanel
            catalog={data}
            loadout={loadout}
            isLoading={authLoading || catalog.isLoading}
            signedIn={signedIn || authLoading}
            onSignIn={signIn}
            onRemove={unequipTitle}
            onClear={clearLoadout}
            pending={equip.isPending}
            onBrowse={setTab}
            onDignity={(title, owned) => setDignityTarget({ title, owned })}
            userId={me?.id ?? null}
            name={me?.name ?? null}
            wearer={me?.name ?? null}
          />
        </aside>

        <Tabs value={tab} onValueChange={(value) => setTab(value as HallTab)} className="min-w-0 gap-4 lg:order-1">
          <TabsList className="h-12 w-full bg-[var(--color-navy-light)] p-1 sm:w-fit">
            <TabsTrigger value="armory" className={TAB_TRIGGER}>
              Shop
            </TabsTrigger>
            <TabsTrigger value="collection" className={TAB_TRIGGER} disabled={!signedIn}>
              Collection
              {data && data.collection.length > 0 && (
                <span className="text-[11px] text-muted-foreground tabular-nums">{data.collection.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="milestones" className={TAB_TRIGGER} disabled={!signedIn}>
              Milestones
              {claimable > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-gold)] px-1.5 text-[10px] font-bold text-[var(--color-navy)]">
                  {claimable}
                  <span className="sr-only"> ready to claim</span>
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="armory">
            {catalog.isLoading || !data ? (
              <ShopSkeleton />
            ) : (
              <Armory
                titles={data.titles}
                collection={data.collection}
                loadout={loadout}
                balance={balance}
                signedIn={signedIn}
                locked={locked}
                busyId={busyId}
                onBuy={setBuyTarget}
                onBestow={setBestowTarget}
                onEquip={equipTitle}
                onUnequip={unequipTitle}
              />
            )}
          </TabsContent>

          <TabsContent value="collection">
            {data ? (
              <CollectionGrid
                titles={data.titles}
                collection={data.collection}
                loadout={loadout}
                busyId={busyId}
                onEquip={equipTitle}
                onUnequip={unequipTitle}
                onBrowse={() => setTab("armory")}
              />
            ) : (
              <ShopSkeleton />
            )}
          </TabsContent>

          <TabsContent value="milestones">
            <MilestonesPanel
              milestones={milestones.data?.milestones}
              isLoading={milestones.isLoading}
              error={milestones.error}
              claimingId={claim.isPending ? (claim.variables?.milestoneId ?? null) : null}
              claimingAll={claim.isPending && !claim.variables?.milestoneId}
              onClaim={(m) => claim.mutate({ milestoneId: m.id })}
              onClaimAll={() => claim.mutate({})}
              onRetry={() => milestones.refetch()}
            />
          </TabsContent>
        </Tabs>
      </div>

      <BuyDialog
        title={buyTarget}
        balance={balance}
        locked={locked}
        equipBlock={buyTarget ? loadout.fitFor(buyTarget) : null}
        renewing={!!buyTarget && data?.collection.some((c) => c.title_id === buyTarget.id && c.games_left === 0) === true}
        pending={buy.isPending}
        onOpenChange={(open) => !open && setBuyTarget(null)}
        onConfirm={confirmBuy}
      />
      <BestowDialog
        title={bestowTarget}
        me={me}
        balance={balance}
        migrated={data?.migrated ?? false}
        pending={buy.isPending}
        onOpenChange={(open) => !open && setBestowTarget(null)}
        onConfirm={confirmBestow}
      />
      <DignityDialog
        target={dignityTarget}
        balance={balance}
        pending={lift.isPending}
        onOpenChange={(open) => !open && setDignityTarget(null)}
        onConfirm={confirmDignity}
      />
      <DebtPledgeDialog
        open={pledged !== null}
        onOpenChange={(open) => !open && setPledged(null)}
        currentBalance={balance ?? 0}
        onConfirm={() => {
          pledged?.()
          setPledged(null)
        }}
      />
    </div>
  )
}

function ShopSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-3">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} className="h-56 w-full rounded-xl" />
      ))}
    </div>
  )
}
