"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface UserProfile {
  id: string
  discord_username: string
  discord_avatar_url: string | null
}

interface CoachSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserId: string | null
  onConfirm: (blueCoachId: string, redCoachId: string) => void
}

export function CoachSelectDialog({
  open,
  onOpenChange,
  currentUserId,
  onConfirm,
}: CoachSelectDialogProps) {
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [blueCoach, setBlueCoach] = useState<string | null>(null)
  const [redCoach, setRedCoach] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    fetch("/api/auth/profiles")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setProfiles(data)
      })
  }, [open])

  useEffect(() => {
    if (open && currentUserId) {
      setBlueCoach(currentUserId)
      setRedCoach(null)
    }
  }, [open, currentUserId])

  const handleConfirm = () => {
    if (!blueCoach || !redCoach) {
      toast.error("Select both coaches")
      return
    }
    if (blueCoach === redCoach) {
      toast.error("Coaches must be different")
      return
    }
    setLoading(true)
    onConfirm(blueCoach, redCoach)
    setLoading(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select Coaches</DialogTitle>
          <DialogDescription>
            Pick who will draft for each team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="mb-2 text-sm font-medium text-[var(--color-blue-team)]">
              Blue Coach
            </div>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setBlueCoach(p.id)}
                  className={cn(
                    "w-full rounded-md px-3 py-1.5 text-left text-sm transition-all",
                    blueCoach === p.id
                      ? "bg-[var(--color-blue-team)]/20 text-[var(--color-blue-team)]"
                      : "text-[var(--color-gold-light)]/70 hover:bg-[var(--color-navy-lighter)]"
                  )}
                >
                  {p.discord_username}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-sm font-medium text-[var(--color-red-team)]">
              Red Coach
            </div>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setRedCoach(p.id)}
                  className={cn(
                    "w-full rounded-md px-3 py-1.5 text-left text-sm transition-all",
                    redCoach === p.id
                      ? "bg-[var(--color-red-team)]/20 text-[var(--color-red-team)]"
                      : "text-[var(--color-gold-light)]/70 hover:bg-[var(--color-navy-lighter)]"
                  )}
                >
                  {p.discord_username}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!blueCoach || !redCoach || blueCoach === redCoach || loading}
            className="bg-purple-600 text-white hover:bg-purple-700"
          >
            Start Coach Draft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
