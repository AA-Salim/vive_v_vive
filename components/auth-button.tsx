"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDownIcon, CrownIcon, LogOutIcon, RefreshCwIcon, UserPlusIcon, UserRoundIcon } from "lucide-react"
import { toast } from "sonner"
import { ClaimPlayerDialog } from "@/components/claim-player-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { DiscordIcon } from "@/components/ui/discord-icon"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuLinkItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

function initialOf(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?"
}

async function syncChampions() {
  const id = toast.loading("Summoning the champion roster from Meraki...")
  try {
    const res = await fetch("/api/champions/sync", { method: "POST" })
    const data = (await res.json().catch(() => null)) as { count?: number; error?: string } | null
    if (res.ok) toast.success(`${data?.count ?? "All"} champions answered the call`, { id })
    else toast.error(data?.error ?? "The sync failed. The champions are sulking.", { id })
  } catch {
    toast.error("Network error. The Rift is unreachable.", { id })
  }
}

export function AuthButton({ className }: { className?: string }) {
  const { user, profile, isAdmin, isLoading, signIn, signOut } = useAuth()
  const [claimOpen, setClaimOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)

  if (isLoading) {
    return <Skeleton className={cn("size-10 rounded-full lg:w-32", className)} />
  }

  if (!user) {
    return (
      <Button variant="royal" size="lg" onClick={() => void signIn()} className={cn("h-10 px-3.5 sm:px-4", className)}>
        <DiscordIcon className="size-[18px]" />
        <span className="sm:hidden">Sign in</span>
        <span className="hidden sm:inline">Sign in with Discord</span>
      </Button>
    )
  }

  const name = profile?.discord_username ?? "Summoner"
  const playerName = profile?.players?.name ?? null
  const runSync = async () => {
    setSyncing(true)
    await syncChampions()
    setSyncing(false)
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Account menu for ${name}`}
          className={cn(
            "group inline-flex h-10 min-w-10 items-center gap-2 rounded-full border border-transparent p-0.5 outline-none transition-colors hover:border-[var(--color-gold)]/30 hover:bg-[var(--color-gold)]/8 focus-visible:ring-3 focus-visible:ring-ring/45 data-popup-open:border-[var(--color-gold)]/40 data-popup-open:bg-[var(--color-gold)]/10 lg:pr-3",
            className
          )}
        >
          <Avatar className="size-9 ring-1 ring-[var(--color-gold)]/40 group-hover:ring-[var(--color-gold)]/70">
            {profile?.discord_avatar_url && <AvatarImage src={profile.discord_avatar_url} alt="" />}
            <AvatarFallback>{initialOf(name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-sm font-medium text-[var(--color-gold-light)] lg:inline">
            {playerName ?? name}
          </span>
          <ChevronDownIcon
            className="hidden size-3.5 text-muted-foreground transition-transform group-data-popup-open:rotate-180 lg:inline"
            aria-hidden
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-64">
          <div className="flex items-center gap-3 px-2 pt-2 pb-2.5">
            <Avatar className="size-10 ring-1 ring-[var(--color-gold)]/40">
              {profile?.discord_avatar_url && <AvatarImage src={profile.discord_avatar_url} alt="" />}
              <AvatarFallback>{initialOf(name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate font-medium text-[var(--color-gold-light)]">
                <span className="truncate">{name}</span>
                {isAdmin && <CrownIcon className="size-3.5 shrink-0 text-[var(--color-gold)]" aria-label="Admin" />}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {playerName ? `Plays as ${playerName}` : "No player claimed yet"}
              </p>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLinkItem render={<Link href="/profile" />}>
              <UserRoundIcon className="text-[var(--color-gold)]/80" />
              Profile and purse
            </DropdownMenuLinkItem>
            {!profile?.player_id && (
              <DropdownMenuItem onClick={() => setClaimOpen(true)}>
                <UserPlusIcon className="text-[var(--color-gold)]/80" />
                Claim your player
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Maintenance</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => void runSync()} disabled={syncing} closeOnClick={false}>
              <RefreshCwIcon className={cn("text-muted-foreground", syncing && "animate-spin")} />
              <span className="text-muted-foreground">{syncing ? "Syncing champions..." : "Sync champions"}</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => void signOut()}>
            <LogOutIcon />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ClaimPlayerDialog open={claimOpen} onOpenChange={setClaimOpen} />
    </>
  )
}
