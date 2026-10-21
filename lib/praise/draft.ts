const DRAFT_KEY = "vvv-praise-draft"

export function readDraft(): string {
  try {
    return window.localStorage.getItem(DRAFT_KEY) ?? ""
  } catch {
    return ""
  }
}

export function writeDraft(text: string): void {
  try {
    if (text.trim()) window.localStorage.setItem(DRAFT_KEY, text)
    else window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    return
  }
}
