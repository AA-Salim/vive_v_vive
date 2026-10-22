"use client"

import { useEffect, useId, useRef, useState } from "react"
import { CrownIcon, FlameIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { VERDICT_HELP } from "@/components/praise/help"
import { ROYAL_FAVOR, VERDICT_NOTE_MAX } from "@/lib/praise/rules"
import type { PraiseVerdict } from "@/lib/praise/types"

interface JudgeControlsProps {
  authorName: string
  crownsLeft: number
  pending: boolean
  // What a crown pays this author once their titles are counted (Throne Polisher).
  favor?: number
  favorNote?: string | null
  onJudge: (verdict: PraiseVerdict, note: string) => void
}

export function JudgeControls({
  authorName,
  crownsLeft,
  pending,
  favor = ROYAL_FAVOR,
  favorNote = null,
  onJudge,
}: JudgeControlsProps) {
  const [mode, setMode] = useState<PraiseVerdict | null>(null)
  const [note, setNote] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const noteId = useId()

  useEffect(() => {
    if (mode) inputRef.current?.focus()
  }, [mode])

  if (!mode) {
    return (
      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2.5">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
            <Button className="h-10" disabled={pending || crownsLeft <= 0} onClick={() => setMode("crowned")}>
              <CrownIcon aria-hidden />
              Crown +{favor}
            </Button>
            <Button variant="destructive" className="h-10" disabled={pending} onClick={() => setMode("scorned")}>
              <FlameIcon aria-hidden />
              Scorn
            </Button>
          </div>
          <InfoTip help={VERDICT_HELP} side="top" align="end" />
        </div>
        {favorNote && <p className="text-[11px] text-[var(--color-gold-light)]/80">{favorNote}</p>}
        {crownsLeft <= 0 && (
          <p className="text-[11px] text-muted-foreground">No crowns left today. Scorn remains free.</p>
        )}
      </div>
    )
  }

  const crowning = mode === "crowned"

  return (
    <form
      className="mt-3 space-y-2 rounded-lg border border-border bg-muted/40 p-2.5"
      onSubmit={(event) => {
        event.preventDefault()
        onJudge(mode, note)
        setMode(null)
        setNote("")
      }}
    >
      <Label htmlFor={noteId} className="text-xs text-muted-foreground">
        {crowning ? `A royal remark for ${authorName} (optional)` : `A public roast for ${authorName} (optional)`}
      </Label>
      <Input
        id={noteId}
        ref={inputRef}
        value={note}
        maxLength={VERDICT_NOTE_MAX}
        onChange={(event) => setNote(event.target.value)}
        placeholder={crowning ? "Say something gracious. Or not." : "Make it sting. Lovingly."}
        className="h-10"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" className="h-10" onClick={() => setMode(null)}>
          Cancel
        </Button>
        <Button type="submit" variant={crowning ? "default" : "destructive"} className="h-10" disabled={pending}>
          {crowning ? <CrownIcon aria-hidden /> : <FlameIcon aria-hidden />}
          {crowning ? `Crown it (+${favor})` : "Scorn it"}
        </Button>
      </div>
    </form>
  )
}
