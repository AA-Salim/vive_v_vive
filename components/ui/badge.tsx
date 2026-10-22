import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-[var(--color-gold-bright)]",
        secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-[var(--color-navy-highlight)]",
        destructive: "border-destructive/30 bg-destructive/15 text-destructive [a]:hover:bg-destructive/25",
        outline: "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost: "hover:bg-muted hover:text-muted-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        royal:
          "border-[var(--color-gold)]/45 bg-linear-to-b from-[var(--color-gold)]/25 to-[var(--color-gold-dark)]/25 font-semibold text-[var(--color-gold-light)]",
        muted: "border-border bg-[var(--color-navy-lighter)]/70 text-muted-foreground",
        blue: "border-[var(--color-blue-team)]/40 bg-[var(--color-blue-team)]/15 text-[var(--color-gold-light)]",
        red: "border-[var(--color-red-team)]/40 bg-[var(--color-red-team)]/15 text-[var(--color-gold-light)]",
        success: "border-[var(--color-success)]/35 bg-[var(--color-success)]/12 text-[var(--color-success)]",
        warning: "border-[var(--color-warning)]/35 bg-[var(--color-warning)]/12 text-[var(--color-warning)]",
        danger: "border-[var(--color-danger)]/40 bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
        roast: "border-[var(--color-roast)]/35 bg-[var(--color-roast)]/12 text-[var(--color-roast)]",
        hextech: "border-[var(--color-hextech)]/35 bg-[var(--color-hextech)]/12 text-[var(--color-hextech)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
