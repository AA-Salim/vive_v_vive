"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { RotateCcwIcon, SwordsIcon } from "lucide-react"
import { StatusScreen } from "@/components/status-screen"
import { Button, buttonVariants } from "@/components/ui/button"

function digestOf(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "digest" in error) {
    const digest = (error as { digest?: unknown }).digest
    return typeof digest === "string" ? digest : null
  }
  return null
}

export default function RouteError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = digestOf(error)
  // A link to the page that crashed would not reset the boundary: on the match room itself, reload instead.
  const onMatchRoom = usePathname() === "/"
  return (
    <StatusScreen
      tone="danger"
      eyebrow="The Rift crashed"
      title="The crown slipped again"
      footnote={digest ? `Error code ${digest}. Hand it to an admin, not to Salaxe.` : undefined}
      actions={
        <>
          <Button variant="royal" size="lg" onClick={() => retry()}>
            <RotateCcwIcon />
            Try again
          </Button>
          {onMatchRoom ? (
            <Button variant="outline" size="lg" onClick={() => window.location.reload()}>
              <SwordsIcon />
              Reload the match room
            </Button>
          ) : (
            <Link href="/" className={buttonVariants({ variant: "outline", size: "lg" })}>
              <SwordsIcon />
              Back to the match room
            </Link>
          )}
        </>
      }
    >
      This page tripped over its own cape. Your points live on the server, not on this screen. Try again, or walk back to the match room with your head held high.
    </StatusScreen>
  )
}
