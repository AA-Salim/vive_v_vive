"use client"

import type { CSSProperties } from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, Loader2Icon, OctagonXIcon, TriangleAlertIcon } from "lucide-react"

const TOASTER_STYLE = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--border-radius": "var(--radius-xl)",
  fontFamily: "var(--font-sans)",
} as CSSProperties

const ICONS: ToasterProps["icons"] = {
  success: <CircleCheckIcon className="size-4" />,
  info: <InfoIcon className="size-4" />,
  warning: <TriangleAlertIcon className="size-4" />,
  error: <OctagonXIcon className="size-4" />,
  loading: <Loader2Icon className="size-4 animate-spin text-[var(--color-gold)]" />,
}

// Live toasts are custom cards: keep toastOptions.classNames.toast free of background, padding and width.
function Toaster({ style, ...props }: ToasterProps) {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      visibleToasts={4}
      gap={10}
      offset={{ top: "calc(72px + env(safe-area-inset-top, 0px))" }}
      mobileOffset={{ top: "calc(64px + env(safe-area-inset-top, 0px))", left: 12, right: 12 }}
      containerAriaLabel="Live notifications"
      className="toaster group"
      icons={ICONS}
      style={{ ...TOASTER_STYLE, ...style }}
      {...props}
    />
  )
}

export { Toaster }
