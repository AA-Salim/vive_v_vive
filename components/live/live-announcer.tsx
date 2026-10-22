"use client"

import { BellRingIcon, HistoryIcon, ZapIcon } from "lucide-react"
import { toast } from "sonner"
import { LiveToast } from "@/components/live/live-toast"
import { metaFor, type DomainMeta } from "@/components/live/domain-meta"
import { notifyFromTab } from "@/components/live/notifier"
import { safeNarrate, summarize } from "@/lib/live/coalesce"
import { buzz, playCue, type CueSize } from "@/lib/live/cues"
import type { LiveEvent } from "@/lib/live/events"
import type { Narration } from "@/lib/live/narration"
import { notifyPlan, sentConfirmation } from "@/lib/live/notify"
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

interface Spill {
  toastId: string
  items: Announced[]
  startedAt: number
  lastAt: number
  version: number
}

interface Announced {
  event: LiveEvent
  line: Narration
}

interface RenderOptions {
  count: number
  version: number
  personal: boolean
  // Catch-all toasts (away digest, flood spillover) carry their own label and no actor.
  meta?: DomainMeta
}

// A burst keeps updating one toast while related events arrive less than COALESCE_MS apart.
const COALESCE_MS = 2_500
const BURST_MAX_MS = 15_000
const BURST_LIMIT = 50
// Flood guard: at most this many new toasts per window (personal alerts are exempt). Events over
// budget are not dropped: they pile into a single "rapid fire" toast that updates in place.
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
const SPILL_META: DomainMeta = { icon: ZapIcon, label: "Rapid fire" }
const SENT_META: DomainMeta = { icon: BellRingIcon, label: "Announced" }
const SENT_DURATION = 3_500

function digest(items: Announced[], title: string): Narration {
  const recent = items.slice(-2).reverse().map((m) => m.line.title)
  const more = items.length - recent.length
  const tones = items.map((m) => liveTone(m.line.tone))
  return {
    title,
    description: recent.join(" · ") + (more > 0 ? ` · +${more} more in the Herald` : ""),
    tone: TONE_RANK.find((t) => tones.includes(t)) ?? "info",
  }
}

export class LiveAnnouncer {
  private bursts = new Map<string, Burst>()
  private spill: Spill | null = null
  private shown: number[] = []
  private away: Announced[] = []

  announce(event: LiveEvent, ctx: AnnounceContext): void {
    const plan = notifyPlan(event)
    const mine = !!ctx.viewer.userId && event.actor?.userId === ctx.viewer.userId
    if (mine) {
      // Never a toast or a sound for your own action, only a word that the announcement went out.
      const sent = plan ? sentConfirmation(plan) : null
      if (sent) this.confirmSent(event, sent)
      return
    }
    // The OS notification brings its own sound: the tab stays silent when one went out.
    const notified = plan ? notifyFromTab(event, plan, ctx.viewer, ctx.prefs) : false

    const decision = toastDecision(event, { phase: ctx.phase, viewer: ctx.viewer, quiet: ctx.prefs.quiet })
    if (!decision.show) return
    const line = safeNarrate(event, decision.personal ? ctx.viewer : undefined)
    if (!line) return
    const tone = liveTone(line.tone)
    const size: CueSize | null = decision.personal ? "personal" : decision.big ? "big" : null

    // A hidden tab would stack stale toasts for later: keep a digest instead (personal alerts still wait in place).
    if (!decision.personal && document.visibilityState === "hidden") {
      this.away = [...this.away, { event, line }].slice(-AWAY_LIMIT)
      if (size && !notified) this.cue(tone, size, ctx.prefs)
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

    if (!decision.personal && !this.takeBudget(now)) {
      this.spillOver({ event, line }, now)
      if (size && !notified) this.cue(tone, size, ctx.prefs)
      return
    }
    const toastId = `live-${event.id}`
    if (key) this.bursts.set(key, { toastId, events: [event], startedAt: now, lastAt: now, version: 0 })
    this.prune(now)
    this.render(toastId, line, event, { count: 1, version: 0, personal: decision.personal })
    if (!notified) this.cue(tone, size ?? "small", ctx.prefs)
  }

  private confirmSent(event: LiveEvent, title: string) {
    toast.custom(
      (id) => (
        <LiveToast
          toastId={id}
          tone="info"
          kicker={SENT_META.label}
          title={title}
          icon={SENT_META.icon}
          duration={SENT_DURATION}
          version={0}
          count={1}
          personal={false}
        />
      ),
      { id: `live-sent-${event.id}`, duration: SENT_DURATION }
    )
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
    const summary = digest(missed, `${missed.length} updates while you were away`)
    this.render(`live-away-${latest.event.id}`, summary, latest.event, {
      count: 1,
      version: 0,
      personal: false,
      meta: DIGEST_META,
    })
  }

  reset(): void {
    this.bursts.clear()
    this.spill = null
    this.shown = []
    this.away = []
  }

  private spillOver(item: Announced, now: number) {
    const open = this.spill && now - this.spill.lastAt < BUDGET_WINDOW_MS && now - this.spill.startedAt < BURST_MAX_MS
    if (!this.spill || !open) {
      this.spill = { toastId: `live-spill-${item.event.id}`, items: [item], startedAt: now, lastAt: now, version: 0 }
      this.render(this.spill.toastId, item.line, item.event, { count: 1, version: 0, personal: false })
      return
    }
    const spill = this.spill
    spill.items = [...spill.items, item].slice(-BURST_LIMIT)
    spill.lastAt = now
    spill.version += 1
    const summary = digest(spill.items, `${spill.items.length} more updates`)
    this.render(spill.toastId, summary, item.event, {
      count: spill.items.length,
      version: spill.version,
      personal: false,
      meta: SPILL_META,
    })
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
    if (this.spill && now - this.spill.lastAt > BURST_MAX_MS) this.spill = null
  }

  private cue(tone: LiveTone, size: CueSize, prefs: LivePrefs) {
    if (prefs.sound) playCue(tone, size)
    if (prefs.vibrate && size !== "small") buzz(tone)
  }

  private render(toastId: string, line: Narration, event: LiveEvent, opts: RenderOptions) {
    const meta = opts.meta ?? metaFor(event.type)
    const tone = liveTone(line.tone)
    const duration = DURATION[tone] + (opts.personal || opts.meta ? 2_000 : 0) + opts.version
    const actor = opts.count > 1 || opts.meta ? null : event.actor
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
