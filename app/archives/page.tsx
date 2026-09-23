"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import type { Act } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function ArchivesPage() {
  const [acts, setActs] = useState<Act[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/acts")
      .then((r) => r.json())
      .then(() => {
        // Fetch all acts for the archive list
        fetch("/api/acts/list")
          .then((r) => r.json())
          .then((data) => setActs(data.acts ?? []))
          .catch(() => {})
          .finally(() => setIsLoading(false))
      })
      .catch(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-gold-light)]/50">Loading...</div>
      </div>
    )
  }

  const archivedActs = acts.filter((a) => a.status === "archived")

  if (archivedActs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-gold-light)]/50">
          No archived acts yet.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--color-gold)]">Archives</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {archivedActs.map((act) => (
          <Link key={act.id} href={`/archives/${act.id}`}>
            <Card className="border-[var(--color-gold)]/20 bg-[var(--color-navy-light)] transition-colors hover:border-[var(--color-gold)]/40">
              <CardHeader>
                <CardTitle className="text-[var(--color-gold)]">
                  {act.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-[var(--color-gold-light)]/50">
                  {act.started_at
                    ? new Date(act.started_at).toLocaleDateString()
                    : "?"}{" "}
                  -{" "}
                  {act.ended_at
                    ? new Date(act.ended_at).toLocaleDateString()
                    : "?"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
