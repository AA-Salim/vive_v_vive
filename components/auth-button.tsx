"use client"

import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ClaimPlayerDialog } from "@/components/claim-player-dialog"
import { useState } from "react"
import Image from "next/image"
import { LogOutIcon, RefreshCwIcon, UserIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export function AuthButton() {
  const { user, profile, isLoading, signIn, signOut } = useAuth()
  const [claimOpen, setClaimOpen] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  const syncChampions = async () => {
    setIsSyncing(true)
    const t = toast.loading("Syncing champions from Meraki API...")
    try {
      const res = await fetch("/api/champions/sync", { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Synced ${data.count} champions`, { id: t })
      } else {
        toast.error(data.error || "Sync failed", { id: t })
      }
    } catch (err) {
      toast.error("Network error during sync", { id: t })
    } finally {
      setIsSyncing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="h-8 w-20 animate-pulse rounded-md bg-[var(--color-navy-lighter)]" />
    )
  }

  if (!user) {
    return (
      <Button
        onClick={signIn}
        size="sm"
        variant="outline"
        className="border-[var(--color-gold)]/20 text-[var(--color-gold-light)]"
      >
        Login with Discord
      </Button>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-[var(--color-navy-lighter)]">
          {profile?.discord_avatar_url ? (
            <Image
              src={profile.discord_avatar_url}
              alt=""
              width={28}
              height={28}
              className="rounded-full"
              unoptimized
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-gold)]/20">
              <UserIcon className="h-4 w-4 text-[var(--color-gold)]" />
            </div>
          )}
          <span className="text-sm text-[var(--color-gold-light)]">
            {profile?.discord_username ?? "User"}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="border-[var(--color-gold)]/20 bg-[var(--color-navy-light)]"
        >
          {!profile?.player_id && (
            <>
              <DropdownMenuItem
                onClick={() => setClaimOpen(true)}
                className="text-[var(--color-gold-light)] focus:bg-[var(--color-navy-lighter)] focus:text-[var(--color-gold)]"
              >
                <UserIcon className="mr-2 h-4 w-4" />
                Claim Player
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[var(--color-gold)]/10" />
            </>
          )}
          <DropdownMenuItem
            onClick={() => signOut()}
            className="text-[var(--color-gold-light)] focus:bg-[var(--color-navy-lighter)] focus:text-[var(--color-gold)]"
          >
            <LogOutIcon className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[var(--color-gold)]/10" />
          <DropdownMenuItem
            onClick={() => syncChampions()}
            disabled={isSyncing}
            className="text-[var(--color-gold-light)]/50 focus:bg-[var(--color-navy-lighter)] focus:text-[var(--color-gold)]"
          >
            <RefreshCwIcon className={cn("mr-2 h-4 w-4", isSyncing && "animate-spin")} />
            Sync Champions
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ClaimPlayerDialog
        open={claimOpen}
        onOpenChange={setClaimOpen}
      />
    </>
  )
}
