"use client"

import { AuthNavSection } from "@/components/auth-nav-section"
import { Brand } from "@/components/nav/brand"
import { DesktopNav } from "@/components/nav/desktop-nav"
import { MobileTabBar } from "@/components/nav/mobile-tab-bar"

// Not sticky on purpose: match-room and titles sidebars stick to the top of the viewport.
// The scrim keeps the translucent iOS status bar readable once the header scrolls away (zero height elsewhere).
export function Nav() {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-[env(safe-area-inset-top,0px)] bg-[var(--color-obsidian)]"
      />
      <header className="relative z-30 border-b border-[var(--color-gold)]/12 bg-linear-to-b from-[var(--color-obsidian)]/85 to-[var(--color-navy)]/50 pt-safe">
        <div className="mx-auto flex h-[var(--app-header-height)] w-full max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <div className="@container flex min-w-0 flex-1 lg:mr-4 lg:flex-none lg:@container-normal">
            <Brand />
          </div>
          <DesktopNav className="mr-auto hidden lg:flex" />
          <AuthNavSection />
        </div>
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/45 to-transparent"
        />
      </header>
      <MobileTabBar />
    </>
  )
}
