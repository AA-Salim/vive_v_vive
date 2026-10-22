"use client"

import { BanIcon, CrownIcon, EyeIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { useServerNow } from "@/components/session/use-clock"
import { SIDE_NAME, cancelLine, relativeTime } from "@/components/session/copy"
import { CANCELED_HELP, RESULT_POINTS_HELP } from "@/components/session/help"
import { winnerOf } from "@/lib/session/constants"
import type { RoomSession } from "@/lib/session/types"
import { cn } from "@/lib/utils"

interface LastGameNoticeProps {
  session: RoomSession
  serverTimeDelta: number
  onView?: () => void
  onDismiss?: () => void
}

export function LastGameNotice({ session, serverTimeDelta, onView, onDismiss }: LastGameNoticeProps) {
  const serverNow = useServerNow(serverTimeDelta, 30_000)
  const winner = winnerOf(session.status)
  const endedAt = Date.parse(session.updated_at)
  const when = serverNow !== null && !Number.isNaN(endedAt) ? relativeTime(endedAt, serverNow) : null
  const who = session.resolver?.name

  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border bg-card px-4 py-3",
        winner === "blue" && "border-[var(--color-blue-team)]/40",
        winner === "red" && "border-[var(--color-red-team)]/40",
        !winner && "border-border"
      )}
    >
      {winner ? (
        <CrownIcon className="mt-0.5 size-4 shrink-0 text-[var(--color-gold)]" aria-hidden />
      ) : (
        <BanIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium text-foreground">
          {winner ? `Last game: ${SIDE_NAME[winner]} won` : `Game canceled${who ? ` by ${who}` : ""}`}
          {when && <span className="font-normal text-muted-foreground"> · {when}</span>}
          <InfoTip help={winner ? RESULT_POINTS_HELP : CANCELED_HELP} className="ml-1 align-middle" />
        </p>
        {!winner && <p className="text-muted-foreground">{cancelLine(session.id)}</p>}
      </div>
      {winner && onView && (
        <Button variant="ghost" className="h-10 shrink-0" onClick={onView}>
          <EyeIcon aria-hidden />
          View result
        </Button>
      )}
      {!winner && onDismiss && (
        <Button variant="ghost" size="icon" className="size-10 shrink-0" aria-label="Dismiss" onClick={onDismiss}>
          <XIcon aria-hidden />
        </Button>
      )}
    </div>
  )
}
