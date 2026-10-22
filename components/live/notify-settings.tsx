"use client"

import { useId, useState } from "react"
import { BellRingIcon, ShareIcon, ShieldAlertIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InfoTip } from "@/components/ui/info-tip"
import { Switch } from "@/components/ui/switch"
import { requestNotifications, useNotifyState, type NotifyState } from "@/components/live/notifier"
import { FREE, type HelpEntry } from "@/lib/help"
import { useLivePrefs } from "@/hooks/use-live-prefs"

export const NOTIFY_HELP: HelpEntry = {
  title: "Notifications",
  does:
    "A notification on this device when a game is launched, decrees open, bets open, the game goes live, the result lands, a game is canceled or the Tribunal opens. Plus the alerts aimed at you: a duel challenge or an accepted duel, a bounty, curse or pillory on you, the verdict on your praise, your pick as a coach.",
  cost: FREE,
  limits:
    "Shown when the app is in the background, minimized or closed (an open tab gets the toast). Never for your own actions. Quiet mode keeps only the alerts aimed at you. Closed-app alerts need you signed in, and on iPhone the app installed on your Home Screen.",
}

export const IOS_INSTALL_HINT = "On iPhone, install the app first (Share > Add to Home Screen), then allow notifications."

function statusLine(state: NotifyState, enabled: boolean): string {
  if (!enabled) return "Off on this device."
  if (state.needsInstall) return "Waiting for the Home Screen app."
  if (state.permission === "unsupported") return "This browser cannot show notifications."
  if (state.permission === "denied") return "Blocked by this browser."
  if (state.permission === "default") return "One tap left: allow them on this device."
  switch (state.push) {
    case "on":
      return "On, even when the app is closed."
    case "pending":
      return "On. Connecting this device for closed-app alerts..."
    case "signed-out":
      return "On while the app is open or minimized. Sign in to get them when it is closed."
    case "error":
      return "On while the app is open or minimized. Closed-app alerts could not be set up."
    default:
      return "On while the app is open or minimized."
  }
}

export function NotifySettings() {
  const id = useId()
  const [prefs, setPrefs] = useLivePrefs()
  const state = useNotifyState()
  const [asking, setAsking] = useState(false)

  const ask = async () => {
    setAsking(true)
    const permission = await requestNotifications()
    setAsking(false)
    if (permission === "granted") setPrefs({ notify: true })
  }

  const onChange = (notify: boolean) => {
    setPrefs({ notify })
    if (notify && state.permission === "default") void ask()
  }

  return (
    <div>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <BellRingIcon className="size-4 shrink-0 text-[var(--color-gold)]/80" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <label htmlFor={id} className="cursor-pointer text-sm font-medium text-foreground">
              Notifications
            </label>
            <InfoTip help={NOTIFY_HELP} side="bottom" align="start" />
          </div>
          <p className="text-xs leading-snug text-muted-foreground" aria-live="polite">
            {statusLine(state, prefs.notify)}
          </p>
        </div>
        <span className="grid min-h-10 min-w-10 place-items-center">
          <Switch id={id} checked={prefs.notify} onCheckedChange={(value) => onChange(value)} />
        </span>
      </div>

      {prefs.notify && state.permission === "default" && (
        <div className="px-4 pb-2.5 pl-11">
          <Button variant="royal" size="lg" className="w-full" onClick={() => void ask()} disabled={asking}>
            <BellRingIcon aria-hidden />
            Turn on notifications
          </Button>
        </div>
      )}
      {prefs.notify && state.permission === "denied" && (
        <p className="mx-4 mb-2.5 ml-11 flex gap-2 rounded-lg border border-[var(--color-red-team)]/35 bg-[var(--color-red-team)]/10 px-2.5 py-2 text-xs leading-snug text-foreground/90">
          <ShieldAlertIcon className="mt-0.5 size-3.5 shrink-0 text-[var(--color-red-team)]" aria-hidden />
          <span>
            Your browser blocked notifications for this site. Allow them in the site settings (the icon left of the
            address), then come back.
          </span>
        </p>
      )}
      {prefs.notify && state.needsInstall && (
        <p className="mx-4 mb-2.5 ml-11 flex gap-2 rounded-lg border border-[var(--color-gold)]/25 bg-[var(--color-gold)]/8 px-2.5 py-2 text-xs leading-snug text-foreground/90">
          <ShareIcon className="mt-0.5 size-3.5 shrink-0 text-[var(--color-gold)]" aria-hidden />
          <span>{IOS_INSTALL_HINT}</span>
        </p>
      )}
    </div>
  )
}
