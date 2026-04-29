"use client"

import { useEffect, useState, useRef } from "react"
import { CrownIcon } from "lucide-react"
import { getRandomBroadcast } from "@/lib/salaxe-broadcasts"

export function SalaxeBroadcast() {
  const [message, setMessage] = useState<string | null>(null)
  const [exiting, setExiting] = useState(false)
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true

    const delay = (3 + Math.random() * 17) * 60 * 1000

    const timer = setTimeout(() => {
      setMessage(getRandomBroadcast())

      setTimeout(() => {
        setExiting(true)
        setTimeout(() => setMessage(null), 400)
      }, 6000)
    }, delay)

    return () => clearTimeout(timer)
  }, [])

  const dismiss = () => {
    setExiting(true)
    setTimeout(() => setMessage(null), 400)
  }

  if (!message) return null

  return (
    <div
      className={`fixed right-6 top-[4.5rem] z-40 max-w-xs cursor-pointer ${
        exiting ? "animate-broadcast-exit" : "animate-broadcast-enter"
      }`}
      onClick={dismiss}
    >
      <div className="rounded-lg border border-[var(--color-gold)]/30 border-l-4 border-l-[var(--color-gold)] bg-[var(--color-navy-light)] p-3 shadow-lg shadow-[var(--color-gold)]/5">
        <div className="mb-1 flex items-center gap-2">
          <CrownIcon className="h-3 w-3 text-[var(--color-gold)]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-gold)]/70">
            Royal Broadcast
          </span>
        </div>
        <p className="text-sm text-[var(--color-gold-light)]">{message}</p>
      </div>
    </div>
  )
}
