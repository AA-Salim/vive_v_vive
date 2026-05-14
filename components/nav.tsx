"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { AuthNavSection } from "@/components/auth-nav-section"

const links = [
  { href: "/", label: "Home" },
  { href: "/champions", label: "Champions" },
  { href: "/history", label: "History" },
  { href: "/rivalries", label: "Rivalries" },
  { href: "/duos", label: "Duos" },
  { href: "/stats", label: "Stats" },
  { href: "/gamba", label: "Gamba" },
  { href: "/leaderboard", label: "Leaderboard" },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-[var(--color-gold)]/20 bg-[var(--color-navy-light)]">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold text-[var(--color-gold)]">
          Vive v Vive Custom
        </Link>
        <div className="flex items-center gap-1">
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
          <div className="ml-3 border-l border-[var(--color-gold)]/20 pl-3">
            <AuthNavSection />
          </div>
        </div>
      </div>
    </nav>
  )
}
