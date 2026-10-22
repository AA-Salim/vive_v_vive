"use client"

import { useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Flag, HandCoins, Lock, LogIn, Skull, Sparkles } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { InfoTip } from "@/components/ui/info-tip"
import { TitleBadge } from "@/components/title-badge"
import { AnimatedNumber } from "@/components/titles/animated-number"
import { CurseCard } from "@/components/titles/curse-card"
import { EffectLines } from "@/components/titles/effect-lines"
import { LoadoutDialog } from "@/components/titles/loadout-dialog"
import { LoadoutEditor } from "@/components/titles/loadout-editor"
import type { LoadoutModel } from "@/components/titles/loadout-model"
import { PerkLine } from "@/components/titles/perk-line"
import { PlayerName } from "@/components/titles/player-name"
import { FREE, pts, type HelpEntry } from "@/lib/help"
import { cn } from "@/lib/utils"
import { HALL_COPY, signed } from "@/lib/titles/copy"
import { involvement } from "@/lib/titles/help"
import { LOADOUT_SLOTS, MAX_EQUIPPED, SLOT_COUNT, SLOT_LABEL } from "@/lib/titles/loadout"
import { CURSE_GAMES, DIGNITY_MULTIPLIER, MAX_ACTIVE_CURSES, perkCap, userPerkCap } from "@/lib/titles/rules"
import type { EquippedTitle, LedgerItem, OwnedTitleView, TitlesCatalogResponse, TitleView } from "@/lib/titles/types"

const BANNER_HELP: HelpEntry = {
  title: "Your loadout",
  does: "The titles you wear. Their immediate effects stack (each capped) the moment you act, your name takes your primary title's colors and epithet everywhere, and every perk pays out on its own after each game.",
  cost: `${FREE} to equip, change or take off. Titles themselves are bought in the Armory or earned from milestones`,
  get reward() {
    return `Up to ${pts(perkCap())} per title and ${pts(userPerkCap())} for all of them, per game`
  },
  limits: `${MAX_EQUIPPED} titles at most: ${LOADOUT_SLOTS.map((slot) => `${SLOT_COUNT[slot]} ${SLOT_LABEL[slot]}`).join(", ")}. Pays after games where ${involvement("you")}. Sealed while a game is live.`,
}

const BRANDS_HELP: HelpEntry = {
  title: "Brands on you",
  does: "Curses the court bought for you. They mark your name everywhere and pay their bestower a tribute after your games.",
  cost: "Each brand takes its toll per game, shown on its card",
  limits: `A brand burns for ${CURSE_GAMES} games, ${MAX_ACTIVE_CURSES} at most. Buy back your dignity for ${DIGNITY_MULTIPLIER}x its price to burn it early.`,
}

const LEDGER_HELP: HelpEntry = {
  title: "Perk ledger",
  does: "Every point your titles moved this act: perks paid, brands charged, and tribute collected from the people you branded.",
  cost: FREE,
  limits: "Resets when a new act begins.",
}

interface BannerPanelProps {
  catalog: TitlesCatalogResponse | undefined
  loadout: LoadoutModel
  isLoading: boolean
  signedIn: boolean
  onSignIn: () => void
  onRemove: (title: TitleView) => void
  onClear: () => void
  pending: boolean
  onBrowse: (tab: "collection" | "armory") => void
  onDignity: (title: TitleView, owned: OwnedTitleView) => void
  // The signed-in user, for the "as others see it" preview.
  userId?: string | null
  name?: string | null
  wearer?: string | null
  // The banner just raised from this page: it gets the title moment.
  raisedId?: string | null
}

function Section({ label, help, children, className }: { label: string; help?: HelpEntry; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <div className="flex items-center gap-1">
        <h2 className="text-[10px] font-bold tracking-[0.18em] text-[var(--color-gold)]/70 uppercase">{label}</h2>
        {help ? <InfoTip help={help} side="top" align="start" /> : null}
      </div>
      {children}
    </section>
  )
}

// How the rest of the court sees the viewer, built from the catalog so it follows an equip instantly.
function selfEntry(banner: TitleView | undefined, owned: OwnedTitleView | undefined, brands: { title: TitleView; owned: OwnedTitleView }[]): EquippedTitle | null {
  if (!banner && brands.length === 0) return null
  const curses = brands.map(({ title, owned: brand }) => ({
    title: title.name,
    perk: brand.perk?.summary ?? "",
    bestowedBy: brand.bestowed_by?.name ?? null,
    gamesLeft: brand.curse?.left ?? 0,
    price: title.price,
    dignityCost: brand.curse?.dignity_cost,
  }))
  const lead = banner ?? brands[0].title
  const wornBrand = !banner || !banner.for_self
  return {
    userId: "self",
    playerId: null,
    title: lead.name,
    category: lead.category,
    perk: owned?.perk?.summary ?? null,
    kind: wornBrand ? "curse" : owned?.perk ? owned.perk.kind : "cosmetic",
    rarity: lead.rarity,
    price: lead.price,
    curses,
  }
}

export function BannerPanel({
  catalog,
  loadout,
  isLoading,
  signedIn,
  onSignIn,
  onRemove,
  onClear,
  pending,
  onBrowse,
  onDignity,
  userId = null,
  name = null,
  wearer = null,
}: BannerPanelProps) {
  const [preview, setPreview] = useState(false)
  if (!signedIn) {
    return (
      <div className="rounded-xl border border-[var(--color-gold)]/25 bg-gradient-to-b from-[var(--color-gold)]/10 to-transparent p-5 text-center">
        <Flag aria-hidden className="mx-auto size-8 text-[var(--color-gold)]" />
        <p className="font-display mt-2 text-lg text-[var(--color-gold-light)]">Claim your place at court</p>
        <p className="mt-1 text-xs text-muted-foreground">{HALL_COPY.signedOut}</p>
        <Button className="mt-4 h-10 w-full gap-2" onClick={onSignIn}>
          <LogIn aria-hidden />
          Sign in with Discord
        </Button>
      </div>
    )
  }

  if (isLoading || !catalog) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    )
  }

  const titleById = new Map(catalog.titles.map((t) => [t.id, t]))
  const single = loadout.worn[0]
  const equipped = single?.owned
  const equippedTitle = single?.title
  const brands = catalog.collection.filter((c) => c.curse?.active)
  const brandViews = brands.flatMap((owned) => {
    const title = titleById.get(owned.title_id)
    return title ? [{ title, owned }] : []
  })
  const me = selfEntry(equippedTitle, equipped, brandViews)

  return (
    <div className="space-y-5 rounded-xl border border-[var(--color-gold)]/20 bg-gradient-to-b from-[var(--color-navy-light)] to-[var(--color-navy)] p-4 shadow-[inset_0_1px_0_0_color-mix(in_oklab,var(--color-gold)_15%,transparent)]">
      {catalog.locked && (
        <Alert className="border-amber-400/30 bg-amber-400/10 text-amber-100">
          <Lock aria-hidden />
          <AlertDescription className="text-amber-100/90">{HALL_COPY.lockNotice}</AlertDescription>
        </Alert>
      )}

      {catalog.loadouts ? (
        <Section label="Your loadout" help={BANNER_HELP}>
          <LoadoutEditor
            loadout={loadout}
            pending={pending}
            onRemove={onRemove}
            onClear={onClear}
            onBrowse={onBrowse}
            onPreview={() => setPreview(true)}
          />
          <LoadoutDialog open={preview} onOpenChange={setPreview} userId={userId} mode="view" name={name} />
        </Section>
      ) : (
        <SingleBanner
          catalog={catalog}
          equipped={equipped}
          equippedTitle={equippedTitle}
          pending={pending}
          onClear={onClear}
          onBrowse={onBrowse}
        />
      )}
      {wearer && me && (
        <div className="min-w-0 rounded-lg border border-border/70 bg-[var(--color-navy)]/60 px-2.5 py-2">
          <p className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">How the court sees you</p>
          <PlayerName name={wearer} title={me} epithet className="mt-0.5 text-sm font-semibold" />
        </div>
      )}

      {brands.length > 0 && (
        <Section label={`Brands on you (${brands.length})`} help={BRANDS_HELP}>
          <AnimatePresence initial={false}>
            {brands.map((owned) => {
              const title = titleById.get(owned.title_id)
              return title ? (
                <CurseCard
                  key={owned.title_id}
                  title={title}
                  owned={owned}
                  locked={catalog.locked}
                  migrated={catalog.migrated}
                  onDignity={onDignity}
                />
              ) : null
            })}
          </AnimatePresence>
        </Section>
      )}

      {catalog.ledger && <Ledger perks={catalog.ledger.perks} tributes={catalog.ledger.tributes} recent={catalog.ledger.recent} />}
    </div>
  )
}

interface SingleBannerProps {
  catalog: TitlesCatalogResponse
  equipped: OwnedTitleView | undefined
  equippedTitle: TitleView | undefined
  pending: boolean
  onClear: () => void
  onBrowse: (tab: "collection" | "armory") => void
}

// Before the loadout migration: one banner at a time.
function SingleBanner({ catalog, equipped, equippedTitle, pending, onClear, onBrowse }: SingleBannerProps) {
  const reduce = useReducedMotion()
  return (
    <Section label="Your banner">
      <p className="text-[11px] text-muted-foreground">{HALL_COPY.loadoutsPending}</p>
      <AnimatePresence mode="wait" initial={false}>
        {equipped && equippedTitle ? (
          <motion.div
            key={equippedTitle.id}
            initial={reduce ? false : { opacity: 0, y: 6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            className="space-y-2.5"
          >
            <TitleBadge
              name={equippedTitle.name}
              category={equippedTitle.category}
              rarity={equippedTitle.rarity}
              perk={equipped.perk}
              description={equippedTitle.description}
              price={equippedTitle.price}
              tier={equippedTitle.tier}
              size="lg"
              interactive
            />
            <EffectLines effects={equippedTitle.effects} className="text-sm" emptyLabel={null} />
            <PerkLine perk={equipped.perk} className="text-sm" />
            <p className="text-xs text-muted-foreground italic">&ldquo;{equippedTitle.description}&rdquo;</p>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="h-10 flex-1" disabled={catalog.locked} onClick={() => onBrowse("collection")}>
                Change
              </Button>
              <Button
                variant="ghost"
                className="h-10 flex-1 text-muted-foreground"
                disabled={catalog.locked || pending}
                onClick={onClear}
              >
                Lower banner
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="none" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <p className="text-sm text-muted-foreground">{HALL_COPY.noBanner}</p>
            <Button
              className="h-10 w-full"
              onClick={() => onBrowse(catalog.collection.some((c) => !c.curse) ? "collection" : "armory")}
            >
              {catalog.collection.some((c) => !c.curse) ? "Raise a banner from your collection" : "Visit the armory"}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  )
}

const LEDGER_ICON = { perk: Sparkles, curse: Skull, tribute: HandCoins }

function Ledger({ perks, tributes, recent }: { perks: number; tributes: number; recent: LedgerItem[] }) {
  return (
    <Section label="Perk ledger · this act" help={LEDGER_HELP}>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-[var(--color-navy)]/70 p-3">
          <p className="text-[10px] tracking-wider text-muted-foreground uppercase">Perks & curses</p>
          <AnimatedNumber
            value={perks}
            signed
            className={cn("font-display text-xl", perks < 0 ? "text-rose-300" : "text-[var(--color-gold-light)]")}
          />
        </div>
        <div className="rounded-lg border border-border bg-[var(--color-navy)]/70 p-3">
          <p className="text-[10px] tracking-wider text-muted-foreground uppercase">Tribute collected</p>
          <AnimatedNumber value={tributes} signed className="font-display text-xl text-[var(--color-gold-light)]" />
        </div>
      </div>
      {recent.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing yet. Your banner pays out after your next game.</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {recent.map((item) => {
            const Icon = LEDGER_ICON[item.kind]
            return (
              <li key={item.id} className="flex items-center gap-2.5 py-2">
                <Icon
                  aria-hidden
                  className={cn("size-3.5 shrink-0", item.kind === "curse" ? "text-rose-400" : "text-[var(--color-gold)]")}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs text-[var(--color-gold-light)]/90">{item.title ?? (item.kind === "tribute" ? "Tribute" : "Title perk")}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{item.detail}</p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-xs font-semibold tabular-nums",
                    item.amount < 0 ? "text-rose-300" : "text-emerald-300"
                  )}
                >
                  {signed(item.amount)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
