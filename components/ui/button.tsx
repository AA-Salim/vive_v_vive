import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonStyles = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,box-shadow,filter,transform] duration-150 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground inset-shadow-highlight hover:bg-[var(--color-gold-bright)] aria-expanded:bg-[var(--color-gold-bright)]",
        royal:
          "border-[var(--color-gold-light)]/30 bg-linear-to-b from-[var(--color-gold-bright)] via-[var(--color-gold)] to-[var(--color-gold-dark)] font-semibold tracking-wide text-[var(--color-navy)] shadow-glow-gold inset-shadow-highlight hover:brightness-110 focus-visible:ring-[var(--color-gold-light)]/50 aria-expanded:brightness-110",
        blue:
          "border-[var(--color-blue-team)]/45 bg-[var(--color-blue-team)]/15 font-semibold text-[var(--color-gold-light)] hover:border-[var(--color-blue-team)]/70 hover:bg-[var(--color-blue-team)]/25 hover:shadow-glow-blue focus-visible:ring-[var(--color-blue-team)]/40 aria-pressed:border-[var(--color-blue-team)] aria-pressed:bg-[var(--color-blue-team)]/30",
        red:
          "border-[var(--color-red-team)]/45 bg-[var(--color-red-team)]/15 font-semibold text-[var(--color-gold-light)] hover:border-[var(--color-red-team)]/70 hover:bg-[var(--color-red-team)]/25 hover:shadow-glow-red focus-visible:ring-[var(--color-red-team)]/40 aria-pressed:border-[var(--color-red-team)] aria-pressed:bg-[var(--color-red-team)]/30",
        outline:
          "border-[var(--color-gold)]/25 bg-[var(--color-navy)]/40 hover:border-[var(--color-gold)]/50 hover:bg-[var(--color-gold)]/10 hover:text-[var(--color-gold-light)] aria-expanded:border-[var(--color-gold)]/50 aria-expanded:bg-[var(--color-gold)]/10",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-[var(--color-navy-highlight)] aria-expanded:bg-[var(--color-navy-highlight)]",
        ghost:
          "hover:bg-[var(--color-gold)]/10 hover:text-[var(--color-gold-light)] aria-expanded:bg-[var(--color-gold)]/10 aria-expanded:text-[var(--color-gold-light)]",
        destructive:
          "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/25 focus-visible:border-destructive/50 focus-visible:ring-destructive/30",
        link: "text-[var(--color-gold)] underline-offset-4 hover:text-[var(--color-gold-bright)] hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-md px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xl: "h-12 gap-2 rounded-xl px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5 [&_svg:not([class*='size-'])]:size-5",
        icon: "size-8",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-md",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonVariantProps = VariantProps<typeof buttonStyles>

// Merged, so links styled as buttons (<Link className={buttonVariants(...)} />) resolve conflicts too.
function buttonVariants(props?: Parameters<typeof buttonStyles>[0]) {
  return cn(buttonStyles(props))
}

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & ButtonVariantProps) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  )
}

export { Button, buttonVariants, type ButtonVariantProps }
