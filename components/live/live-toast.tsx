"use client"

import { useEffect, useRef } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { XIcon, type LucideIcon } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TONE_CHIP } from "@/components/live/domain-meta"
import type { LiveActor } from "@/lib/live/events"
import type { LiveTone } from "@/lib/live/tone"
import { cn } from "@/lib/utils"

export interface LiveToastProps {
  toastId: string | number
  tone: LiveTone
  kicker: string
  title: string
  description?: string
  actor?: LiveActor | null
  icon: LucideIcon
  duration: number
  version: number
  count: number
  personal: boolean
}

const TONE_CARD: Record<LiveTone, string> = {
  info: "border-border",
  hype: "border-[var(--color-gold)]/45 bg-linear-to-br from-[var(--color-gold)]/14 via-popover to-popover",
  royal: "border-[var(--color-gold-dark)] bg-linear-to-br from-[var(--color-gold-dark)]/40 via-popover to-popover",
  roast: "border-[var(--color-red-team)]/30 bg-linear-to-br from-[var(--color-red-team)]/10 via-popover to-popover",
  danger: "border-[var(--color-red-team)]/55 bg-linear-to-br from-[var(--color-red-team)]/20 via-popover to-popover",
}

const TONE_KICKER: Record<LiveTone, string> = {
  info: "text-muted-foreground",
  hype: "text-[var(--color-gold)]",
  royal: "text-[var(--color-gold)]",
  roast: "text-[var(--color-red-team)]",
  danger: "text-[var(--color-red-team)]",
}

const TONE_BAR: Record<LiveTone, string> = {
  info: "bg-[var(--color-gold-light)]/35",
  hype: "bg-[var(--color-gold)]",
  royal: "bg-linear-to-r from-[var(--color-gold-dark)] via-[var(--color-gold)] to-[var(--color-gold-light)]",
  roast: "bg-[var(--color-red-team)]/70",
  danger: "bg-[var(--color-red-team)]",
}

function initialOf(name: string) {
  return name.trim().charAt(0).toUpperCase() || "?"
}

// Mirrors sonner's own pause rules (toaster hovered, tab hidden) so the bar matches the real lifetime.
function useTimerBar(duration: number, version: number, disabled: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || disabled || typeof el.animate !== "function") return
    const animation = el.animate([{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }], {
      duration,
      easing: "linear",
      fill: "forwards",
    })
    const toaster = el.closest("[data-sonner-toaster]")
    const pause = () => animation.pause()
    const resume = () => {
      if (document.visibilityState === "visible") animation.play()
    }
    const onVisibility = () => (document.visibilityState === "visible" ? resume() : pause())
    toaster?.addEventListener("mouseenter", pause)
    toaster?.addEventListener("mouseleave", resume)
    document.addEventListener("visibilitychange", onVisibility)
    if (document.visibilityState !== "visible") pause()
    return () => {
      animation.cancel()
      toaster?.removeEventListener("mouseenter", pause)
      toaster?.removeEventListener("mouseleave", resume)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [duration, version, disabled])
  return ref
}

export function LiveToast({
  toastId,
  tone,
  kicker,
  title,
  description,
  actor,
  icon: Icon,
  duration,
  version,
  count,
  personal,
}: LiveToastProps) {
  const reduceMotion = useReducedMotion() ?? false
  const barRef = useTimerBar(duration, version, reduceMotion)
  const shine = !reduceMotion && (personal || tone === "hype" || tone === "royal")

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg shadow-black/40 min-[601px]:w-[var(--width)]",
        "[&>*]:transition-opacity [&>*]:duration-200 in-[[data-front=false][data-expanded=false]]:[&>*]:opacity-0",
        TONE_CARD[tone],
        personal && "ring-2 ring-[var(--color-gold)]/60"
      )}
    >
      {shine && (
        <motion.span
          key={version}
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-linear-to-r from-transparent via-[var(--color-gold-light)]/15 to-transparent"
          initial={{ x: "0%" }}
          animate={{ x: "420%" }}
          transition={{ duration: 1.1, ease: "easeOut", delay: 0.12 }}
        />
      )}

      <div className="flex items-start gap-3 py-3 pr-11 pl-3">
        <div className="relative mt-0.5 shrink-0">
          {actor ? (
            <Avatar className="size-9">
              {actor.avatarUrl && <AvatarImage src={actor.avatarUrl} alt="" />}
              <AvatarFallback className="bg-[var(--color-navy-lighter)] font-semibold text-[var(--color-gold-light)]">
                {initialOf(actor.name)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <span className={cn("grid size-9 place-items-center rounded-full ring-1", TONE_CHIP[tone])}>
              <Icon className="size-4" aria-hidden />
            </span>
          )}
          {actor && (
            <span
              className={cn(
                "absolute -right-1 -bottom-1 grid size-[18px] place-items-center rounded-full ring-2 ring-popover",
                TONE_CHIP[tone]
              )}
            >
              <Icon className="size-2.5" aria-hidden />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("truncate text-[10px] font-semibold tracking-[0.16em] uppercase", TONE_KICKER[tone])}>
              {kicker}
            </span>
            {personal && (
              <span className="shrink-0 rounded-full bg-[var(--color-gold)] px-1.5 text-[9px] leading-4 font-bold tracking-wider text-[var(--color-navy)] uppercase">
                For you
              </span>
            )}
            <AnimatePresence initial={false}>
              {count > 1 && (
                <motion.span
                  key={count}
                  initial={reduceMotion ? false : { scale: 1.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] leading-4 font-semibold text-foreground tabular-nums"
                  aria-label={`${count} updates`}
                >
                  x{count}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <p
            className={cn(
              "mt-0.5 line-clamp-2 text-sm leading-snug font-semibold wrap-break-word text-foreground",
              tone === "royal" && "font-display"
            )}
          >
            {title}
          </p>
          {description && (
            <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug wrap-break-word text-muted-foreground">
              {description}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => toast.dismiss(toastId)}
        aria-label="Dismiss notification"
        className="absolute top-1.5 right-1.5 grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors outline-none after:absolute after:-inset-1 hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <XIcon className="size-4" aria-hidden />
      </button>

      {!reduceMotion && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-foreground/5" aria-hidden>
          <div ref={barRef} className={cn("h-full origin-left", TONE_BAR[tone])} />
        </div>
      )}
    </div>
  )
}
