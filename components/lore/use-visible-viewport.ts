"use client"

import { useSyncExternalStore, type CSSProperties } from "react"

const GUTTER = 12

export interface VisibleBox {
  left: number
  top: number
  width: number
  height: number
}

function subscribe(onChange: () => void) {
  const vv = window.visualViewport
  window.addEventListener("resize", onChange)
  vv?.addEventListener("resize", onChange)
  vv?.addEventListener("scroll", onChange)
  return () => {
    window.removeEventListener("resize", onChange)
    vv?.removeEventListener("resize", onChange)
    vv?.removeEventListener("scroll", onChange)
  }
}

// Larger than any scrollbar, so desktop scrollbars never count as a mismatch.
const MISMATCH_PX = 32

// Empty while the layout viewport matches the screen. Otherwise "left:top:width:height" of the visible area.
function snapshot(): string {
  const vv = window.visualViewport
  if (!vv || Math.abs(vv.scale - 1) > 0.01) return ""
  if (window.innerWidth - vv.width < MISMATCH_PX && window.innerHeight - vv.height < MISMATCH_PX) return ""
  return [vv.offsetLeft, vv.offsetTop, vv.width, vv.height].map(Math.round).join(":")
}

// On phones, anything wider than the screen stretches the layout viewport, and fixed elements positioned
// against it land off-screen. Null when the CSS positioning can be trusted.
export function useVisibleBox(): VisibleBox | null {
  const raw = useSyncExternalStore(subscribe, snapshot, () => "")
  if (!raw) return null
  const [left, top, width, height] = raw.split(":").map(Number)
  return { left, top, width, height }
}

export function useVisibleViewport(maxWidth: number): CSSProperties | undefined {
  const box = useVisibleBox()
  if (!box) return undefined
  const fitted = Math.max(0, Math.min(maxWidth, box.width - GUTTER * 2))
  return {
    left: box.left + box.width / 2,
    top: box.top + box.height / 2,
    width: fitted,
    maxWidth: fitted,
    maxHeight: Math.max(0, box.height - GUTTER * 2),
  }
}

export function bottomDockStyle(box: VisibleBox | null, maxWidth: number): CSSProperties | undefined {
  if (!box) return undefined
  const width = Math.max(0, Math.min(maxWidth, box.width - GUTTER * 2))
  return {
    left: box.left + box.width - GUTTER - width,
    top: box.top + box.height - GUTTER,
    right: "auto",
    bottom: "auto",
    width,
    transform: "translateY(-100%)",
  }
}
