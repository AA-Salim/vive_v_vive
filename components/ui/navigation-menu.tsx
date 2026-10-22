"use client"

import type { CSSProperties } from "react"
import { NavigationMenu as NavigationMenuPrimitive } from "@base-ui/react/navigation-menu"
import { cva } from "class-variance-authority"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

const MOTION = { "--duration": "0.32s", "--easing": "cubic-bezier(0.22, 1, 0.36, 1)" } as CSSProperties

function NavigationMenu({
  className,
  children,
  align = "start",
  ...props
}: NavigationMenuPrimitive.Root.Props & Pick<NavigationMenuPrimitive.Positioner.Props, "align">) {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      className={cn("relative flex max-w-max items-center", className)}
      {...props}
    >
      {children}
      <NavigationMenuPositioner align={align} />
    </NavigationMenuPrimitive.Root>
  )
}

function NavigationMenuList({ className, ...props }: NavigationMenuPrimitive.List.Props) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn("flex items-center gap-0.5", className)}
      {...props}
    />
  )
}

function NavigationMenuItem({ className, ...props }: NavigationMenuPrimitive.Item.Props) {
  return (
    <NavigationMenuPrimitive.Item
      data-slot="navigation-menu-item"
      className={cn("relative", className)}
      {...props}
    />
  )
}

const navigationMenuTriggerStyle = cva(
  "group/navigation-menu-trigger relative inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium whitespace-nowrap text-[var(--color-gold-light)]/75 transition-[color,background-color] outline-none select-none hover:bg-[var(--color-gold)]/8 hover:text-[var(--color-gold-light)] focus-visible:ring-3 focus-visible:ring-ring/45 data-popup-open:bg-[var(--color-gold)]/10 data-popup-open:text-[var(--color-gold-light)] data-active:text-[var(--color-gold)] [&_svg]:pointer-events-none [&_svg]:shrink-0"
)

function NavigationMenuTrigger({ className, children, ...props }: NavigationMenuPrimitive.Trigger.Props) {
  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={cn(navigationMenuTriggerStyle(), className)}
      {...props}
    >
      {children}
      <NavigationMenuPrimitive.Icon className="transition-transform duration-200 data-popup-open:rotate-180">
        <ChevronDownIcon className="size-3.5 opacity-70" aria-hidden />
      </NavigationMenuPrimitive.Icon>
    </NavigationMenuPrimitive.Trigger>
  )
}

function NavigationMenuContent({ className, ...props }: NavigationMenuPrimitive.Content.Props) {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={cn(
        "h-full w-max p-2 transition-[opacity,transform,translate] duration-(--duration) ease-(--easing)",
        "data-starting-style:opacity-0 data-ending-style:opacity-0",
        "data-starting-style:data-[activation-direction=left]:translate-x-[-40%] data-starting-style:data-[activation-direction=right]:translate-x-[40%]",
        "data-ending-style:data-[activation-direction=left]:translate-x-[40%] data-ending-style:data-[activation-direction=right]:translate-x-[-40%]",
        className
      )}
      {...props}
    />
  )
}

function NavigationMenuPositioner({
  className,
  side = "bottom",
  sideOffset = 10,
  align = "start",
  alignOffset = 0,
  ...props
}: NavigationMenuPrimitive.Positioner.Props) {
  return (
    <NavigationMenuPrimitive.Portal>
      <NavigationMenuPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        collisionPadding={{ top: 8, bottom: 8, left: 16, right: 16 }}
        collisionAvoidance={{ side: "none" }}
        style={MOTION}
        className={cn(
          "isolate z-50 h-(--positioner-height) w-(--positioner-width) max-w-(--available-width) transition-[top,left,right,bottom] duration-(--duration) ease-(--easing) data-instant:transition-none",
          "before:absolute before:inset-x-0 before:-top-2.5 before:h-2.5 before:content-['']",
          className
        )}
        {...props}
      >
        <NavigationMenuPrimitive.Popup
          data-slot="navigation-menu-popup"
          className="relative h-(--popup-height) w-(--popup-width) origin-(--transform-origin) overflow-hidden rounded-xl border border-[var(--color-gold)]/22 bg-popover text-popover-foreground shadow-popover outline-none transition-[opacity,transform,width,height,scale] duration-(--duration) ease-(--easing) data-ending-style:scale-95 data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-95 data-starting-style:opacity-0"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-6 top-0 z-10 h-px bg-linear-to-r from-transparent via-[var(--color-gold)]/70 to-transparent"
          />
          <NavigationMenuPrimitive.Viewport className="relative size-full overflow-hidden" />
        </NavigationMenuPrimitive.Popup>
      </NavigationMenuPrimitive.Positioner>
    </NavigationMenuPrimitive.Portal>
  )
}

function NavigationMenuLink({ className, ...props }: NavigationMenuPrimitive.Link.Props) {
  return (
    <NavigationMenuPrimitive.Link
      data-slot="navigation-menu-link"
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--color-gold-light)]/80 transition-colors outline-none hover:bg-[var(--color-gold)]/8 hover:text-[var(--color-gold-light)] focus-visible:ring-3 focus-visible:ring-ring/45 data-active:text-[var(--color-gold)] [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

export {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuPositioner,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
}
