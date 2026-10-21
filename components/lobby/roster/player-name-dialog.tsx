"use client"

import { useState, type FormEvent } from "react"
import { Loader2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PLAYER_NAME_MAX } from "@/lib/lobby/constants"

interface PlayerNameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "add" | "rename"
  initialName?: string
  pending: boolean
  onSubmit: (name: string) => void
}

function NameForm({ mode, initialName = "", pending, onSubmit, onCancel }: Omit<PlayerNameDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const [name, setName] = useState(initialName)
  const trimmed = name.trim()
  const unchanged = mode === "rename" && trimmed === initialName.trim()
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!trimmed || unchanged || pending) return
    onSubmit(trimmed)
  }
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="lobby-player-name">Summoner name</Label>
        <Input
          id="lobby-player-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={PLAYER_NAME_MAX}
          autoComplete="off"
          autoFocus
          placeholder="e.g. Chalaksse"
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">
          {PLAYER_NAME_MAX - name.length} characters left. Names are unique, capitals do not count.
        </p>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" className="h-10" onClick={onCancel} disabled={pending}>
          Never mind
        </Button>
        <Button type="submit" className="h-10 font-semibold" disabled={!trimmed || unchanged || pending}>
          {pending && <Loader2Icon className="animate-spin" aria-hidden />}
          {mode === "add" ? "Add to the roster" : "Rename"}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function PlayerNameDialog({ open, onOpenChange, mode, initialName, pending, onSubmit }: PlayerNameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-lg">{mode === "add" ? "A new challenger" : `Rename ${initialName}`}</DialogTitle>
          <DialogDescription>
            {mode === "add"
              ? "They join the active roster right away. Their Discord account can claim them later."
              : "History, titles and stats follow the player. Only the name changes."}
          </DialogDescription>
        </DialogHeader>
        <NameForm
          key={`${mode}:${initialName ?? ""}`}
          mode={mode}
          initialName={initialName}
          pending={pending}
          onSubmit={onSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
