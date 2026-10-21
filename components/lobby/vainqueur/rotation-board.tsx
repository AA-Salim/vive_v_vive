"use client"

import type { ReactNode } from "react"
import { LayoutGroup, motion } from "motion/react"
import { ArmchairIcon, CrownIcon, DicesIcon, HandIcon, LogInIcon, LogOutIcon } from "lucide-react"
import type { RotationPlan } from "@/lib/lobby/rotation"
import { cn } from "@/lib/utils"

type Tone = "throne" | "incoming" | "staying" | "lottery" | "out" | "idle"

const CHIP: Record<Tone, string> = {
  throne: "border-[var(--color-gold)]/60 bg-[var(--color-gold)]/15 text-[var(--color-gold-light)]",
  incoming: "border-[var(--color-gold-light)]/35 bg-[var(--color-gold-light)]/[0.06] text-[var(--color-gold-light)]",
  staying: "border-border bg-muted/60 text-[var(--color-gold-light)]/90",
  lottery: "border-dashed border-[var(--color-gold)]/35 bg-transparent text-[var(--color-gold-light)]/80",
  out: "border-[var(--color-red-team)]/30 bg-[var(--color-red-team)]/[0.07] text-[var(--color-gold-light)]/70",
  idle: "border-border bg-transparent text-muted-foreground",
}

function Chip({ id, name, tone, me, volunteer }: { id: string; name: string; tone: Tone; me: boolean; volunteer?: boolean }) {
  return (
    <motion.li
      layoutId={`rotation-${id}`}
      layout
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={cn(
        "inline-flex h-7 max-w-[9.5rem] items-center gap-1 rounded-full border px-2.5 text-xs font-medium",
        CHIP[tone],
        me && "ring-2 ring-[var(--color-gold)]/70 ring-offset-1 ring-offset-card"
      )}
    >
      {volunteer && <HandIcon className="size-3 shrink-0 text-[var(--color-gold)]" aria-label="Volunteered" />}
      <span className="truncate">{name}</span>
    </motion.li>
  )
}

function Group({ icon, label, hint, children, empty }: { icon: ReactNode; label: string; hint?: string; children: ReactNode; empty?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-gold)]/90">
          {icon}
          {label}
        </span>
        {hint && <span className="text-right text-[11px] text-muted-foreground">{hint}</span>}
      </div>
      {empty ? <p className="text-xs text-muted-foreground">{empty}</p> : <ul className="flex flex-wrap gap-1.5">{children}</ul>}
    </div>
  )
}

interface RotationBoardProps {
  plan: RotationPlan
  satOut: string[]
  volunteers: string[]
  nameOf: (id: string) => string
  myId: string | null
}

export function RotationBoard({ plan, satOut, volunteers, nameOf, myId }: RotationBoardProps) {
  const chip = (id: string, tone: Tone) => (
    <Chip key={id} id={id} name={nameOf(id)} tone={tone} me={id === myId} volunteer={volunteers.includes(id)} />
  )
  const incoming = [...plan.comingIn, ...plan.forced]
  const benchedWinners = satOut.filter((id) => !plan.forced.includes(id))
  const stayHint = [
    plan.loyal.length > 0 && `${plan.loyal.length} stay`,
    plan.lottery.seats > 0 && `${plan.lottery.seats} by lot`,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <LayoutGroup>
      <div className="relative flex flex-col gap-3 rounded-xl border border-border bg-[var(--color-navy)]/60 p-3">
        <Group icon={<CrownIcon className="size-3.5" aria-hidden />} label="Hold the throne" hint={`${plan.staying.length} winners stay`}>
          {plan.staying.map((id) => chip(id, "throne"))}
        </Group>

        <div aria-hidden className="h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/30 to-transparent" />

        <Group
          icon={<LogInIcon className="size-3.5" aria-hidden />}
          label="Stepping in"
          hint={incoming.length > 0 ? "from the queue" : undefined}
          empty={incoming.length === 0 ? "Nobody in the queue. The losers get their rematch." : undefined}
        >
          {plan.comingIn.map((id) => chip(id, "incoming"))}
          {plan.forced.map((id) => chip(id, "incoming"))}
        </Group>

        {(plan.loyal.length > 0 || plan.lottery.seats > 0) && (
          <Group icon={<HandIcon className="size-3.5" aria-hidden />} label="Losers who stay" hint={stayHint}>
            {plan.loyal.map((id) => chip(id, "staying"))}
            {plan.lottery.among.map((id) => chip(id, "lottery"))}
          </Group>
        )}
        {plan.lottery.seats > 0 && (
          <p className="-mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <DicesIcon className="size-3.5 shrink-0" aria-hidden />
            {plan.lottery.seats} of the dashed names keep a seat, drawn at random. Volunteers go first.
          </p>
        )}

        {plan.rotatingOut.length > 0 && (
          <Group icon={<LogOutIcon className="size-3.5" aria-hidden />} label="Rotating out" hint="to the back of the queue">
            {plan.rotatingOut.map((id) => chip(id, "out"))}
          </Group>
        )}

        {benchedWinners.length > 0 && (
          <Group icon={<ArmchairIcon className="size-3.5" aria-hidden />} label="Gave up their seat" hint="waiting in the queue">
            {benchedWinners.map((id) => chip(id, "idle"))}
          </Group>
        )}
      </div>
    </LayoutGroup>
  )
}
