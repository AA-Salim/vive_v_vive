"use client"

import Link from "next/link"
import { UserRoundIcon, type LucideIcon } from "lucide-react"
import { DiscordIcon } from "@/components/ui/discord-icon"
import { Button } from "@/components/ui/button"
import { Crest } from "@/components/ui/crest"
import { DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { actNumeral } from "@/components/nav/brand"
import { NAV_GROUPS, isActivePath } from "@/components/nav/nav-links"
import { useAct } from "@/hooks/use-act"
import { useAuth } from "@/hooks/use-auth"

const TILE =
  "group flex min-h-14 items-center gap-3 rounded-xl border border-[var(--color-gold)]/15 bg-[var(--color-navy)]/55 px-3 py-2.5 text-sm font-medium text-[var(--color-gold-light)] transition-colors outline-none hover:border-[var(--color-gold)]/40 focus-visible:ring-3 focus-visible:ring-ring/45 active:bg-[var(--color-gold)]/10 aria-[current=page]:border-[var(--color-gold)]/55 aria-[current=page]:bg-[var(--color-gold)]/10 aria-[current=page]:text-[var(--color-gold)]"

function TileIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)] text-[var(--color-gold)]/85 group-aria-[current=page]:border-[var(--color-gold)]/60 group-aria-[current=page]:text-[var(--color-gold)]">
      <Icon className="size-[18px]" aria-hidden />
    </span>
  )
}

export function MoreDrawerContent({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
  const { user, profile, signIn } = useAuth()
  const { act } = useAct()
  const subtitle = act ? `Act ${actNumeral(act.act_number)}${act.subtitle ? `: ${act.subtitle}` : ""}` : "Every hall of the Charamil"
  const profileActive = isActivePath(pathname, "/profile")

  return (
    <DrawerContent>
      <DrawerHeader className="flex-row items-center gap-3 px-1">
        <Crest className="size-11" />
        <div className="min-w-0">
          <DrawerTitle>The whole court</DrawerTitle>
          <DrawerDescription className="truncate">{subtitle}</DrawerDescription>
        </div>
      </DrawerHeader>

      <div className="space-y-5 pb-2">
        {NAV_GROUPS.filter((group) => group.id !== "play").map((group) => (
          <section key={group.id} aria-labelledby={`more-nav-${group.id}`}>
            <h3 id={`more-nav-${group.id}`} className="mb-2 flex items-baseline gap-2 px-1">
              <span className="type-eyebrow text-[var(--color-gold)]">{group.label}</span>
              <span className="truncate text-xs text-muted-foreground">{group.blurb}</span>
            </h3>
            <ul className="grid grid-cols-2 gap-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={onNavigate}
                    aria-current={isActivePath(pathname, link.href) ? "page" : undefined}
                    className={TILE}
                  >
                    <TileIcon icon={link.icon} />
                    <span className="truncate">{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section aria-labelledby="more-nav-you">
          <h3 id="more-nav-you" className="mb-2 px-1">
            <span className="type-eyebrow text-[var(--color-gold)]">You</span>
          </h3>
          {user ? (
            <Link
              href="/profile"
              onClick={onNavigate}
              aria-current={profileActive ? "page" : undefined}
              className={TILE}
            >
              <TileIcon icon={UserRoundIcon} />
              <span className="min-w-0">
                <span className="block truncate">Profile</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {profile?.players?.name ?? profile?.discord_username ?? "Your purse and history"}
                </span>
              </span>
            </Link>
          ) : (
            <Button variant="royal" size="lg" className="w-full" onClick={() => void signIn()}>
              <DiscordIcon className="size-5" />
              Sign in with Discord
            </Button>
          )}
        </section>
      </div>
    </DrawerContent>
  )
}
