"use client"

import { useEffect, useState } from "react"
import { CHAMPION_POOLS, getChampionImageUrl, ROLE_LABELS, ALL_ROLES, type Champion } from "@/lib/champions"
import type { Role } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { LaneIcon } from "@/components/lane-icon"
import Image from "next/image"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { SearchIcon } from "lucide-react"

export default function ChampionsPage() {
  const [pools, setPools] = useState<Record<Role, Champion[]>>(CHAMPION_POOLS)
  const [loading, setLoading] = useState(true)
  const [searchTerms, setSearchTerms] = useState<Record<Role, string>>({
    top: "",
    jungle: "",
    mid: "",
    adc: "",
    support: ""
  })

  useEffect(() => {
    async function fetchPools() {
      try {
        const res = await fetch("/api/champions")
        const data = await res.json()
        if (data && !data.error) {
          setPools(data)
        }
      } catch (error) {
        console.error("Failed to fetch champion pools:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchPools()
  }, [])

  const handleSearchChange = (role: Role, value: string) => {
    setSearchTerms(prev => ({ ...prev, [role]: value }))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-[var(--color-gold)]">Champions by Role</h1>
        <p className="text-[var(--color-gold-light)]/60">
          The current champion pools used for randomization in each lane.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {ALL_ROLES.map((role) => {
          const filteredChampions = (pools[role] || [])
            .filter(c => c.name.toLowerCase().includes(searchTerms[role].toLowerCase()))
            .sort((a, b) => a.name.localeCompare(b.name))

          return (
            <Card key={role} className="flex flex-col border-[var(--color-gold)]/20 bg-[var(--color-navy-light)]">
              <CardHeader className="flex flex-col gap-3 border-b border-[var(--color-gold)]/10 pb-4">
                <div className="flex flex-row items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-gold)]/10 text-[var(--color-gold)]">
                    <LaneIcon lane={role} className="h-6 w-6" />
                  </div>
                  <div className="flex flex-col">
                    <CardTitle className="text-xl text-[var(--color-gold)]">{ROLE_LABELS[role]}</CardTitle>
                    <span className="text-xs text-[var(--color-gold-light)]/40">
                      {loading ? "..." : filteredChampions.length} Champions
                    </span>
                  </div>
                </div>
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-gold-light)]/30" />
                  <Input
                    placeholder={`Search ${ROLE_LABELS[role]}...`}
                    value={searchTerms[role]}
                    onChange={(e) => handleSearchChange(role, e.target.value)}
                    className="h-8 border-[var(--color-gold)]/10 bg-[var(--color-navy)]/50 pl-9 text-xs text-[var(--color-gold-light)] placeholder:text-[var(--color-gold-light)]/20 focus-visible:ring-[var(--color-gold)]/30"
                  />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="divide-y divide-[var(--color-gold)]/5">
                    {loading ? (
                      Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3">
                          <Skeleton className="h-8 w-8 rounded-full bg-[var(--color-gold)]/10" />
                          <Skeleton className="h-4 w-24 bg-[var(--color-gold)]/10" />
                        </div>
                      ))
                    ) : filteredChampions.length > 0 ? (
                      filteredChampions.map((champion) => (
                        <div
                          key={`${role}-${champion.internal}`}
                          className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-gold)]/5"
                        >
                          <div className="relative h-9 w-9 overflow-hidden rounded-full border border-[var(--color-gold)]/20">
                            <Image
                              src={getChampionImageUrl(champion.internal)}
                              alt={champion.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <span className="text-sm font-medium text-[var(--color-gold-light)]">
                            {champion.name}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <span className="text-xs text-[var(--color-gold-light)]/20">No champions found</span>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
