"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

interface PlayerAvatarProps {
  name: string
  avatarUrl: string | null
  size?: "sm" | "default" | "lg"
  className?: string
}

export function PlayerAvatar({ name, avatarUrl, size = "default", className }: PlayerAvatarProps) {
  return (
    <Avatar size={size} className={className}>
      {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
      <AvatarFallback className={cn("font-semibold uppercase", size === "lg" && "text-base")}>
        {name.trim().slice(0, 1) || "?"}
      </AvatarFallback>
    </Avatar>
  )
}
