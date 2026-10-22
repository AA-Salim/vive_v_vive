const numberFormat = new Intl.NumberFormat("en-US")
const compactFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 })
const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" })
const dayYearFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
const shortDayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" })
const shortDayYearFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" })
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" })
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

export const formatNumber = (value: number) => numberFormat.format(value)

export const formatCompact = (value: number) => (Math.abs(value) >= 10_000 ? compactFormat.format(value) : numberFormat.format(value))

export function formatSigned(value: number): string {
  if (value === 0) return "0"
  return `${value > 0 ? "+" : "-"}${numberFormat.format(Math.abs(value))}`
}

export function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`
}

const sameYear = (date: Date) => date.getFullYear() === new Date().getFullYear()

export function formatDay(iso: string): string {
  const date = new Date(iso)
  return (sameYear(date) ? dayFormat : dayYearFormat).format(date)
}

export function formatShortDay(iso: string | number): string {
  const date = new Date(iso)
  return (sameYear(date) ? shortDayFormat : shortDayYearFormat).format(date)
}

// "YYYY-MM-DD" keys parse as UTC midnight, which is the day before west of Greenwich: read them at local noon.
export const formatDayKey = (key: string) => formatShortDay(/^\d{4}-\d{2}-\d{2}$/.test(key) ? `${key}T12:00:00` : key)

export const formatTime = (iso: string) => timeFormat.format(new Date(iso))

export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso))

// Game nights run past midnight: anything before 6 a.m. (local time) belongs to the evening before.
export function localDayKey(iso: string | number): string {
  const date = new Date(iso)
  const shifted = new Date(date.getTime() - 6 * 3_600_000)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, "0")}-${String(shifted.getDate()).padStart(2, "0")}`
}

export function plural(count: number, word: string, many = `${word}s`): string {
  return `${formatNumber(count)} ${count === 1 ? word : many}`
}

export function daysBetween(startIso: string, endIso: string | null): number {
  const end = endIso ? Date.parse(endIso) : Date.now()
  return Math.max(1, Math.round((end - Date.parse(startIso)) / 86_400_000))
}
