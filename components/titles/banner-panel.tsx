"use client"

import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Flag, HandCoins, Lock, LogIn, Skull, Sparkles } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { TitleBadge } from "@/components/title-badge"
import { AnimatedNumber } from "@/components/titles/animated-number"
import { CurseCard } from "@/components/titles/curse-card"
import { PerkLine } from "@/components/titles/perk-line"
import { cn } from "@/lib/utils"
import { HALL_COPY, signed } from "@/lib/titles/copy"
import type { LedgerItem, OwnedTitleView, TitlesCatalogResponse, TitleView } from "@/lib/titles/types"

interface BannerPanelProps {
  catalog: TitlesCatalogResponse | undefined
  isLoading: boolean
  signedIn: boolean
  onSignIn: () => void
  onUnequip: () => void
  unequipping: boolean
  onBrowse: (tab: "collection" | "armory") => void
  onDignity: (title: TitleView, owned: OwnedTitleView) => void
}

function Section({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-2.5", className)}>
      <h2 className="text-[10px] font-bold tracking-[0.18em] text-[var(--color-gold)]/70 uppercase">{label}</h2>
      {children}
    </section>
  )
}

export function BannerPanel({ catalog, isLoading, signedIn, onSignIn, onUnequip, unequipping, onBrowse, onDignity }: BannerPanelProps) {
  const reduce = useReducedMotion()

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
  const equipped = catalog.collection.find((c) => c.is_active)
  const equippedTitle = equipped ? titleById.get(equipped.title_id) : undefined
  const brands = catalog.collection.filter((c) => c.curse?.active)

  return (
    <div className="space-y-5 rounded-xl border border-[var(--color-gold)]/20 bg-gradient-to-b from-[var(--color-navy-light)] to-[var(--color-navy)] p-4 shadow-[inset_0_1px_0_0_color-mix(in_oklab,var(--color-gold)_15%,transparent)]">
      {catalog.locked && (
        <Alert className="border-amber-400/30 bg-amber-400/10 text-amber-100">
          <Lock aria-hidden />
          <AlertDescription className="text-amber-100/90">{HALL_COPY.lockNotice}</AlertDescription>
        </Alert>
      )}

      <Section label="Your banner">
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
                size="lg"
                interactive
              />
              <PerkLine perk={equipped.perk} className="text-sm" />
              <p className="text-xs text-muted-foreground italic">&ldquo;{equippedTitle.description}&rdquo;</p>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="h-10 flex-1" disabled={catalog.locked} onClick={() => onBrowse("collection")}>
                  Change
                </Button>
                <Button
                  variant="ghost"
                  className="h-10 flex-1 text-muted-foreground"
                  disabled={catalog.locked || unequipping}
                  onClick={onUnequip}
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

      {brands.length > 0 && (
        <Section label={`Brands on you (${brands.length})`}>
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

const LEDGER_ICON = { perk: Sparkles, curse: Skull, tribute: HandCoins }

function Ledger({ perks, tributes, recent }: { perks: number; tributes: number; recent: LedgerItem[] }) {
  return (
    <Section label="Perk ledger · this act">
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
