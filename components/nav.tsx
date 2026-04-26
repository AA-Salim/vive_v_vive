"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

const links = [
  { href: "/", label: "Home" },
  { href: "/stats", label: "Stats" },
  { href: "/history", label: "History" },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-[var(--color-gold)]/20 bg-[var(--color-navy-light)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold text-[var(--color-gold)]">
          Vive v Vive Custom
        </Link>
        <div className="flex gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === link.href
                  ? "bg-[var(--color-gold)]/10 text-[var(--color-gold)]"
                  : "text-[var(--color-gold-light)]/70 hover:text-[var(--color-gold-light)]"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  )
}
