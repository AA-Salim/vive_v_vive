// A line of lore split into plain text and highlighted values, so the UI can gild names and numbers
// without guessing where they are.

export type LoreMark = "name" | "num" | "blue" | "red" | "salaxe" | "title"

export interface LoreSegment {
  text: string
  mark?: LoreMark
}

export type LoreValue = string | number | { text: string | number; mark?: LoreMark }

export interface LoreLine {
  id: string
  text: string
  segments: LoreSegment[]
}

function valueSegment(value: LoreValue): LoreSegment {
  if (typeof value === "object") return { text: String(value.text), mark: value.mark }
  return { text: String(value) }
}

export function renderSegments(template: string, values: Record<string, LoreValue>): LoreSegment[] {
  const segments: LoreSegment[] = []
  const pattern = /\{(\w+)\}/g
  let cursor = 0
  for (const match of template.matchAll(pattern)) {
    const index = match.index ?? 0
    if (index > cursor) segments.push({ text: template.slice(cursor, index) })
    const value = values[match[1]]
    segments.push(value === undefined ? { text: match[0] } : valueSegment(value))
    cursor = index + match[0].length
  }
  if (cursor < template.length) segments.push({ text: template.slice(cursor) })
  return segments.filter((s) => s.text.length > 0)
}

export function segmentsText(segments: LoreSegment[]): string {
  return segments.map((s) => s.text).join("")
}

export function loreLine(id: string, template: string, values: Record<string, LoreValue>): LoreLine {
  const segments = renderSegments(template, values)
  return { id, text: segmentsText(segments), segments }
}

export const asName = (text: string): LoreValue => ({ text, mark: "name" })
export const asNum = (text: string | number): LoreValue => ({ text, mark: "num" })
