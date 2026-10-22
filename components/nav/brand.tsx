"use client"

import Link from "next/link"
import { Crest } from "@/components/ui/crest"
import { useAct } from "@/hooks/use-act"
import { cn } from "@/lib/utils"

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]

export function actNumeral(n: number) {
  return ROMAN[n] ?? String(n)
}

export function Brand({ className }: { className?: string }) {
  const { act } = useAct()
  const numeral = act ? actNumeral(act.act_number) : null

  return (
    <Link
      href="/"
      aria-label="Vive v Vive Custom, back to the match room"
      className={cn(
        "group flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/45",
        className
      )}
    >
      <Crest className="size-9 transition-transform duration-300 ease-hextech group-hover:scale-105 group-active:scale-95" />
      <span className="hidden min-w-0 flex-col @[9.5rem]:flex lg:flex">
        <span className="gilded font-display text-[15px] leading-none font-bold tracking-[0.06em] whitespace-nowrap sm:text-base">
          Vive v Vive
        </span>
        {numeral && (
          <span className="mt-1 truncate text-[10px] leading-none font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            Act {numeral}
            {act?.subtitle && <span className="hidden sm:inline"> · {act.subtitle}</span>}
          </span>
        )}
      </span>
    </Link>
  )
}
