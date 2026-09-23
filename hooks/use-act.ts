"use client"

import { useState, useEffect } from "react"
import type { Act } from "@/lib/types"

export function useAct() {
  const [act, setAct] = useState<Act | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch("/api/acts")
      .then((r) => r.json())
      .then((data) => setAct(data.act ?? null))
      .catch(() => {})
      .finally(() => setIsLoading(false))
  }, [])

  return { act, isLoading }
}
