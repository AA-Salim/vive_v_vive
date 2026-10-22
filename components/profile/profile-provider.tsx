"use client"

import { createContext, useCallback, useContext, useMemo, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { ProfileSheet } from "@/components/profile/profile-sheet"
import { usePrefetchProfile } from "@/components/profile/use-player-profile"
import { cn } from "@/lib/utils"

type OpenProfile = (player: string) => void

interface ProfileContextValue {
  open: OpenProfile
}

const ProfileContext = createContext<ProfileContextValue | null>(null)

// One quick-profile sheet for the whole app. Pass a player uuid (or, failing that, a player name).
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const show = useCallback<OpenProfile>((next) => {
    if (!next) return
    setPlayer(next)
    setOpen(true)
  }, [])
  const value = useMemo(() => ({ open: show }), [show])

  return (
    <ProfileContext.Provider value={value}>
      {children}
      <ProfileSheet player={player} open={open} onOpenChange={setOpen} />
    </ProfileContext.Provider>
  )
}

// Outside the provider (tests, isolated trees) the full page is the fallback.
export function useOpenProfile(): OpenProfile {
  const ctx = useContext(ProfileContext)
  const router = useRouter()
  return useMemo(() => ctx?.open ?? ((player: string) => router.push(`/players/${encodeURIComponent(player)}`)), [ctx, router])
}

interface ProfileTriggerProps {
  // A player uuid; a name works too for surfaces that only know names.
  playerId?: string | null
  name?: string | null
  children: ReactNode
  // "span" for triggers that sit inside another button or link (a button cannot nest in a button).
  as?: "button" | "span"
  className?: string
}

// Turns any name or avatar into an accessible button that opens the quick profile. Clicks never reach the parent.
export function ProfileTrigger({ playerId, name, children, as = "button", className }: ProfileTriggerProps) {
  const open = useOpenProfile()
  const prefetch = usePrefetchProfile()
  const target = playerId || name || null
  if (!target) return <>{children}</>

  const activate = (event: MouseEvent | KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()
    open(target)
  }
  const props = {
    "aria-label": name ? `Open the court file of ${name}` : undefined,
    onClick: activate,
    onPointerEnter: () => prefetch(target),
    onFocus: () => prefetch(target),
    className: cn(
      "relative inline-flex max-w-full min-w-0 cursor-pointer items-center gap-[inherit] rounded-md text-left text-inherit outline-none transition-colors",
      "before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] hover:text-[var(--color-gold-light)] focus-visible:ring-2 focus-visible:ring-[var(--color-gold)]/60",
      className
    ),
  }

  if (as === "span") {
    return (
      <span
        role="button"
        tabIndex={0}
        {...props}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") activate(event)
        }}
      >
        {children}
      </span>
    )
  }
  return (
    <button type="button" {...props}>
      {children}
    </button>
  )
}
