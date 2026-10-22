"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

import { cn } from "@/lib/utils"

function Drawer<Payload = unknown>({ swipeDirection = "down", ...props }: DrawerPrimitive.Root.Props<Payload>) {
  return <DrawerPrimitive.Root swipeDirection={swipeDirection} {...props} />
}

function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

// A bottom sheet that follows the finger: swipe down to dismiss, safe-area aware.
function DrawerContent({ className, children, ...props }: DrawerPrimitive.Popup.Props) {
  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Backdrop
        data-slot="drawer-overlay"
        className="fixed inset-0 z-50 min-h-dvh bg-[var(--color-obsidian)] opacity-[calc(0.72*(1-var(--drawer-swipe-progress,0)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*400ms)] data-starting-style:opacity-0 supports-[-webkit-touch-callout:none]:absolute"
      />
      <DrawerPrimitive.Viewport data-slot="drawer-viewport" className="fixed inset-0 z-50 flex items-end justify-center">
        <DrawerPrimitive.Popup
          data-slot="drawer-content"
          className={cn(
            "relative -mb-12 max-h-[calc(88dvh+3rem)] w-full touch-auto overflow-y-auto overscroll-contain rounded-t-2xl border-t border-[var(--color-gold)]/30 bg-popover px-4 pt-2.5 pb-[calc(1rem+env(safe-area-inset-bottom,0px)+3rem)] text-popover-foreground shadow-popover outline-none sm:max-w-lg sm:border-x",
            "[transform:translateY(var(--drawer-swipe-movement-y,0px))] transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none data-ending-style:[transform:translateY(calc(100%-3rem+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength,1)*400ms)] data-starting-style:[transform:translateY(calc(100%-3rem+2px))]",
            className
          )}
          {...props}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-10 top-0 h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/80 to-transparent"
          />
          <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--color-gold)]/35" />
          {children}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </DrawerPrimitive.Portal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="drawer-header" className={cn("flex flex-col gap-1 pb-3", className)} {...props} />
}

function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("font-heading text-lg font-semibold tracking-wide text-[var(--color-gold-light)]", className)}
      {...props}
    />
  )
}

function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger }
