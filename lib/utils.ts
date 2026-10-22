import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teaches tailwind-merge the custom theme tokens from app/globals.css, so a caller's shadow-[...], ease-*
// or bg-linear-* replaces the primitive's default instead of losing to it on CSS source order.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ["card", "raised", "popover", "glow-gold", "glow-blue", "glow-red"],
      "inset-shadow": ["highlight", "sheen"],
      ease: ["hextech"],
      animate: ["shimmer", "glow", "rise", "broadcast-enter", "broadcast-exit"],
    },
    classGroups: {
      "bg-image": ["surface-glow"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
