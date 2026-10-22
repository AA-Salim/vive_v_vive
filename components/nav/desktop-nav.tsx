"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { LiveGameDot } from "@/components/nav/live-game-dot"
import { NAV_GROUPS, PLAY_LINK, groupIsActive, isActivePath, type NavGroup } from "@/components/nav/nav-links"
import { useLiveGame } from "@/components/nav/use-live-game"
import { cn } from "@/lib/utils"

// The gold bar sits on the header's bottom edge, like the League client's active tab.
const ACTIVE_BAR =
  "after:pointer-events-none after:absolute after:inset-x-3 after:-bottom-[13px] after:h-0.5 after:rounded-full after:bg-[var(--color-gold)] after:opacity-0 after:shadow-[0_0_10px_var(--color-gold)] after:transition-opacity data-active:after:opacity-100"

function GroupPanel({ group, pathname }: { group: NavGroup; pathname: string }) {
  return (
    <div className="w-[34rem] max-w-[calc(100vw-2rem)] p-1">
      <p className="type-eyebrow px-3 pt-2 pb-2 text-[var(--color-gold)]/80">{group.blurb}</p>
      <ul className="grid grid-cols-2 gap-1">
        {group.links.map((link) => {
          const Icon = link.icon
          const active = isActivePath(pathname, link.href)
          return (
            <li key={link.href}>
              <NavigationMenuLink
                render={<Link href={link.href} />}
                active={active}
                closeOnClick
                className="group/link items-start gap-3 p-3 data-active:bg-[var(--color-gold)]/8"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--color-gold)]/20 bg-[var(--color-navy)]/70 text-[var(--color-gold)]/85 transition-colors group-hover/link:border-[var(--color-gold)]/45 group-hover/link:text-[var(--color-gold)] group-data-active/link:border-[var(--color-gold)]/60 group-data-active/link:text-[var(--color-gold)]">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block font-medium text-[var(--color-gold-light)] group-data-active/link:text-[var(--color-gold)]">
                    {link.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{link.description}</span>
                </span>
              </NavigationMenuLink>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function DesktopNav({ className }: { className?: string }) {
  const pathname = usePathname()
  const game = useLiveGame()
  const playActive = isActivePath(pathname, PLAY_LINK.href)
  const PlayIcon = PLAY_LINK.icon

  return (
    <NavigationMenu aria-label="Main" className={className}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuLink
            render={<Link href={PLAY_LINK.href} />}
            active={playActive}
            className={cn(navigationMenuTriggerStyle(), ACTIVE_BAR, "gap-2")}
          >
            <PlayIcon className="size-4" aria-hidden />
            {PLAY_LINK.label}
            {game.active && <LiveGameDot label={game.label} showLabel={!playActive} />}
          </NavigationMenuLink>
        </NavigationMenuItem>
        {NAV_GROUPS.filter((group) => group.id !== "play").map((group) => (
          <NavigationMenuItem key={group.id} value={group.id}>
            <NavigationMenuTrigger
              data-active={groupIsActive(pathname, group) ? "" : undefined}
              className={ACTIVE_BAR}
            >
              {group.label}
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <GroupPanel group={group} pathname={pathname} />
            </NavigationMenuContent>
          </NavigationMenuItem>
        ))}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
