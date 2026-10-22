"use client"

import type { ReactNode } from "react"
import { SearchIcon, XIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
}

interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  label: string
  className?: string
}

export function Segmented<T extends string>({ value, onChange, options, label, className }: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex max-w-full rounded-xl border border-[var(--color-gold)]/20 bg-[var(--color-navy)]/60 p-1", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:flex-none",
            value === option.value
              ? "bg-[var(--color-gold)] text-[var(--color-navy)]"
              : "text-[var(--color-gold-light)]/70 hover:text-[var(--color-gold-light)]"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  className?: string
}

export function SearchField({ value, onChange, placeholder, label, className }: SearchFieldProps) {
  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 border-[var(--color-gold)]/15 bg-[var(--color-navy)]/60 pr-10 pl-9 text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      ) : null}
    </div>
  )
}

export const EVERYONE = "everyone"

interface PlayerSelectProps {
  value: string | null
  onChange: (playerId: string | null) => void
  players: { id: string; name: string }[]
  label: string
  everyoneLabel?: string
  className?: string
}

export function PlayerSelect({ value, onChange, players, label, everyoneLabel = "Everyone", className }: PlayerSelectProps) {
  const items = [{ value: EVERYONE, label: everyoneLabel }, ...players.map((p) => ({ value: p.id, label: p.name }))]
  if (value && !players.some((p) => p.id === value)) items.push({ value, label: "Selected player" })
  return (
    <Select
      items={items}
      value={value ?? EVERYONE}
      onValueChange={(next) => onChange(!next || next === EVERYONE ? null : String(next))}
    >
      <SelectTrigger
        aria-label={label}
        className={cn("h-10 min-w-40 border-[var(--color-gold)]/15 bg-[var(--color-navy)]/60 data-[size=default]:h-10", className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} className="min-h-9">
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
