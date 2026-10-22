"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, useReducedMotion } from "motion/react"
import { LayoutGridIcon, type LucideIcon } from "lucide-react"
import { Drawer, DrawerTrigger } from "@/components/ui/drawer"
import { LiveGameDot } from "@/components/nav/live-game-dot"
import { MoreDrawerContent } from "@/components/nav/more-drawer"
import { ALL_LINKS, PLAY_LINK, isActivePath, navLink, type NavLink } from "@/components/nav/nav-links"
import { useLiveGame } from "@/components/nav/use-live-game"
import { cn } from "@/lib/utils"

const TABS: NavLink[] = [PLAY_LINK, navLink("/leaderboard"), navLink("/gamba"), navLink("/titles")]
const MORE_HREFS = [...ALL_LINKS.filter((link) => !TABS.includes(link)).map((link) => link.href), "/profile"]

const TAB_CLASS =
  "relative flex h-full w-full flex-col items-center justify-center gap-1 rounded-xl text-[11px] leading-none font-medium tracking-wide text-muted-foreground transition-colors outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/45 active:scale-[0.97] aria-[current=page]:text-[var(--color-gold)] data-[current=true]:text-[var(--color-gold)]"

function TabIndicator({ active }: { active: boolean }) {
  const reduce = useReducedMotion()
  if (!active) return null
  return (
    <motion.span
      layoutId={reduce ? undefined : "tab-indicator"}
      aria-hidden
      className="pointer-events-none absolute inset-x-0 -top-px z-10 mx-auto h-0.5 w-9 rounded-full bg-[var(--color-gold)] shadow-[0_0_12px_var(--color-gold)]"
      transition={{ type: "spring", stiffness: 520, damping: 40 }}
    />
  )
}

function TabContent({ icon: Icon, label, dot }: { icon: LucideIcon; label: string; dot?: ReactNode }) {
  return (
    <>
      <span className="relative">
        <Icon className="size-[22px]" aria-hidden />
        {dot && <span className="absolute -top-0.5 -right-1.5">{dot}</span>}
      </span>
      <span>{label}</span>
    </>
  )
}

export function MobileTabBar() {
  const pathname = usePathname()
  const game = useLiveGame()
  const [moreOpen, setMoreOpen] = useState(false)
  const inMore = MORE_HREFS.some((href) => isActivePath(pathname, href))

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-gold)]/20 bg-[var(--color-navy-light)]/96 pb-safe shadow-[0_-12px_32px_-16px_var(--color-obsidian)] backdrop-blur-lg lg:hidden"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/50 to-transparent"
      />
      <ul className="mx-auto grid h-[var(--app-tabbar-height)] max-w-xl grid-cols-5 px-1">
        {TABS.map((tab) => {
          const active = isActivePath(pathname, tab.href)
          const isPlay = tab.href === PLAY_LINK.href
          return (
            <li key={tab.href} className="relative p-1">
              <TabIndicator active={active} />
              <Link href={tab.href} aria-current={active ? "page" : undefined} className={TAB_CLASS}>
                <TabContent
                  icon={tab.icon}
                  label={tab.short}
                  dot={isPlay && game.active ? <LiveGameDot label={game.label} /> : undefined}
                />
              </Link>
            </li>
          )
        })}
        <li className="relative p-1">
          <TabIndicator active={inMore} />
          <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
            <DrawerTrigger
              data-current={inMore}
              aria-label={inMore ? "More pages, current section" : "More pages"}
              className={cn(TAB_CLASS, moreOpen && "text-[var(--color-gold-light)]")}
            >
              <TabContent icon={LayoutGridIcon} label="More" />
            </DrawerTrigger>
            <MoreDrawerContent pathname={pathname} onNavigate={() => setMoreOpen(false)} />
          </Drawer>
        </li>
      </ul>
    </nav>
  )
}
