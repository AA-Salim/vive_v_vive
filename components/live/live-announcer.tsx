"use client"

import { HistoryIcon } from "lucide-react"
import { toast } from "sonner"
import { LiveToast } from "@/components/live/live-toast"
import { metaFor, type DomainMeta } from "@/components/live/domain-meta"
import { safeNarrate, summarize } from "@/lib/live/coalesce"
import { buzz, playChime } from "@/lib/live/cues"
import type { LiveEvent } from "@/lib/live/events"
import type { Narration } from "@/lib/live/narration"
import { coalesceKey, toastDecision, type LivePhase, type Viewer } from "@/lib/live/policy"
import { TONE_RANK, liveTone, type LiveTone } from "@/lib/live/tone"
import type { LivePrefs } from "@/hooks/use-live-prefs"

export interface AnnounceContext {
  phase: LivePhase
  viewer: Viewer
  prefs: LivePrefs
}

interface Burst {
  toastId: string
  events: LiveEvent[]
  startedAt: number
  lastAt: number
  version: number
}

interface RenderOptions {
  count: number
  version: number
  personal: boolean
  digest?: boolean
}

// A burst keeps updating one toast while related events arrive less than COALESCE_MS apart.
const COALESCE_MS = 2_500
const BURST_MAX_MS = 15_000
const BURST_LIMIT = 50
// Flood guard: at most this many new toasts per window (personal alerts are exempt).
const BUDGET = 5
const BUDGET_WINDOW_MS = 8_000
const AWAY_LIMIT = 30

const DURATION: Record<LiveTone, number> = {
  info: 4_500,
  hype: 6_000,
  royal: 6_500,
  roast: 6_000,
  danger: 7_500,
}

const DIGEST_META: DomainMeta = { icon: HistoryIcon, label: "Catch up" }

export class LiveAnnouncer {
  private bursts = new Map<string, Burst>()
  private shown: number[] = []
  private away: { event: LiveEvent; line: Narration }[] = []

  announce(event: LiveEvent, ctx: AnnounceContext): void {
    const decision = toastDecision(event, { phase: ctx.phase, viewer: ctx.viewer, quiet: ctx.prefs.quiet })
    if (!decision.show) return
    const line = safeNarrate(event)
    if (!line) return

    // A hidden tab would stack stale toasts for later: keep a digest instead (personal alerts still wait in place).
    if (!decision.personal && document.visibilityState === "hidden") {
      this.away = [...this.away, { event, line }].slice(-AWAY_LIMIT)
      if (decision.big) this.cue(liveTone(line.tone), ctx.prefs)
      return
    }

    const now = Date.now()
    const key = decision.personal ? null : coalesceKey(event)
    const burst = key ? this.bursts.get(key) : undefined
    if (key && burst && now - burst.lastAt < COALESCE_MS && now - burst.startedAt < BURST_MAX_MS) {
      burst.events = [...burst.events, event].slice(-BURST_LIMIT)
      burst.lastAt = now
      burst.version += 1
      const summary = summarize(key, burst.events, line)
      this.render(burst.toastId, summary, event, { count: burst.events.length, version: burst.version, personal: false })
      return
    }

    if (!decision.personal && !this.takeBudget(now)) return
    const toastId = `live-${event.id}`
    if (key) this.bursts.set(key, { toastId, events: [event], startedAt: now, lastAt: now, version: 0 })
    this.prune(now)
    this.render(toastId, line, event, { count: 1, version: 0, personal: decision.personal })
    if (decision.big) this.cue(liveTone(line.tone), ctx.prefs)
  }

  // Called when the tab becomes visible again: one digest toast for everything missed meanwhile.
  welcomeBack(): void {
    const missed = this.away
    this.away = []
    if (missed.length === 0) return
    const latest = missed[missed.length - 1]
    if (missed.length === 1) {
      this.render(`live-${latest.event.id}`, latest.line, latest.event, { count: 1, version: 0, personal: false })
      return
    }
    const recent = missed.slice(-2).reverse().map((m) => m.line.title)
    const more = missed.length - recent.length
    const tones = missed.map((m) => liveTone(m.line.tone))
    const digest: Narration = {
      title: `${missed.length} updates while you were away`,
      description: recent.join(" · ") + (more > 0 ? ` · +${more} more in the Herald` : ""),
      tone: TONE_RANK.find((t) => tones.includes(t)) ?? "info",
    }
    this.render(`live-away-${latest.event.id}`, digest, latest.event, { count: 1, version: 0, personal: false, digest: true })
  }

  reset(): void {
    this.bursts.clear()
    this.shown = []
    this.away = []
  }

  private takeBudget(now: number): boolean {
    this.shown = this.shown.filter((t) => now - t < BUDGET_WINDOW_MS)
    if (this.shown.length >= BUDGET) return false
    this.shown.push(now)
    return true
  }

  private prune(now: number) {
    for (const [key, burst] of this.bursts) {
      if (now - burst.lastAt > BURST_MAX_MS) this.bursts.delete(key)
    }
  }

  private cue(tone: LiveTone, prefs: LivePrefs) {
    if (prefs.sound) playChime(tone)
    if (prefs.vibrate) buzz(tone)
  }

  private render(toastId: string, line: Narration, event: LiveEvent, opts: RenderOptions) {
    const meta = opts.digest ? DIGEST_META : metaFor(event.type)
    const tone = liveTone(line.tone)
    const duration = DURATION[tone] + (opts.personal || opts.digest ? 2_000 : 0) + opts.version
    const actor = opts.count > 1 || opts.digest ? null : event.actor
    toast.custom(
      (id) => (
        <LiveToast
          toastId={id}
          tone={tone}
          kicker={meta.label}
          title={line.title}
          description={line.description}
          actor={actor}
          icon={meta.icon}
          duration={duration}
          version={opts.version}
          count={opts.count}
          personal={opts.personal}
        />
      ),
      { id: toastId, duration }
    )
  }
}
