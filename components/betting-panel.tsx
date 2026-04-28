"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase-client"
import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import type { BettingPool, Side } from "@/lib/types"

interface BettingPanelProps {
  sessionId: string
}

export function BettingPanel({ sessionId }: BettingPanelProps) {
  const { user, signIn } = useAuth()
  const { balance, isLoading: pointsLoading, refetch: refetchPoints } = usePoints(user?.id ?? null)
  const [pool, setPool] = useState<BettingPool | null>(null)
  const [selectedSide, setSelectedSide] = useState<Side | null>(null)
  const [amount, setAmount] = useState("")
  const [placing, setPlacing] = useState(false)
  const supabaseRef = useRef(createClient())

  const fetchPool = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}/bets`)
      if (res.ok) {
        const data = await res.json()
        setPool(data)
      }
    } catch {}
  }, [sessionId])

  useEffect(() => {
    fetchPool()
  }, [fetchPool])

  useEffect(() => {
    const supabase = supabaseRef.current
    const channel = supabase
      .channel("bets-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bets",
          filter: `session_id=eq.${sessionId}`,
        },
        () => fetchPool()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, fetchPool])

  const handleBet = async () => {
    if (!user) {
      signIn()
      return
    }
    if (!selectedSide || !amount) return

    const numAmount = parseInt(amount, 10)
    if (isNaN(numAmount) || numAmount < 1) {
      toast.error("Enter a valid amount")
      return
    }
    if (numAmount > balance) {
      toast.error("Insufficient balance")
      return
    }

    setPlacing(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: selectedSide, amount: numAmount }),
      })
      if (res.ok) {
        toast.success(`Bet placed: ${numAmount} on ${selectedSide}`)
        await fetchPool()
        await refetchPoints()
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to place bet")
      }
    } catch {
      toast.error("Failed to place bet")
    } finally {
      setPlacing(false)
    }
  }

  if (!pool) return null

  const hasBet = !!pool.user_bet

  return (
    <div className="rounded-lg border border-[var(--color-gold)]/20 bg-[var(--color-navy-light)] p-4">
      <h3 className="mb-3 text-center text-sm font-bold tracking-wider text-[var(--color-gold)]">
        BETTING
      </h3>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="text-center">
          <div className="text-xs font-medium text-[var(--color-blue-team)]">
            BLUE SIDE
          </div>
          <div className="text-2xl font-bold text-[var(--color-blue-team)]">
            {pool.blue_total}
          </div>
          {pool.blue_multiplier && (
            <div className="text-xs text-[var(--color-gold-light)]/60">
              {pool.blue_multiplier.toFixed(1)}x
            </div>
          )}
        </div>

        <div className="text-center">
          <div className="text-xs text-[var(--color-gold-light)]/50">POOL</div>
          <div className="text-lg font-bold text-[var(--color-gold)]">
            {pool.total}
          </div>
          <div className="text-xs text-[var(--color-gold-light)]/50">
            {pool.bet_count} bet{pool.bet_count !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="text-center">
          <div className="text-xs font-medium text-[var(--color-red-team)]">
            RED SIDE
          </div>
          <div className="text-2xl font-bold text-[var(--color-red-team)]">
            {pool.red_total}
          </div>
          {pool.red_multiplier && (
            <div className="text-xs text-[var(--color-gold-light)]/60">
              {pool.red_multiplier.toFixed(1)}x
            </div>
          )}
        </div>
      </div>

      {hasBet ? (
        <div className="mt-4 rounded-md bg-[var(--color-navy)]/50 p-3 text-center">
          <div className="text-xs text-[var(--color-gold-light)]/60">
            Your bet
          </div>
          <div className="text-sm font-bold text-[var(--color-gold)]">
            {pool.user_bet!.amount} on{" "}
            <span
              className={
                pool.user_bet!.side === "blue"
                  ? "text-[var(--color-blue-team)]"
                  : "text-[var(--color-red-team)]"
              }
            >
              {pool.user_bet!.side === "blue" ? "Blue" : "Red"}
            </span>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex justify-center gap-2">
            <Button
              size="sm"
              variant={selectedSide === "blue" ? "default" : "outline"}
              onClick={() => setSelectedSide("blue")}
              className={
                selectedSide === "blue"
                  ? "bg-[var(--color-blue-team)] text-white"
                  : "border-[var(--color-blue-team)]/30 text-[var(--color-blue-team)]"
              }
            >
              Blue
            </Button>
            <Button
              size="sm"
              variant={selectedSide === "red" ? "default" : "outline"}
              onClick={() => setSelectedSide("red")}
              className={
                selectedSide === "red"
                  ? "bg-[var(--color-red-team)] text-white"
                  : "border-[var(--color-red-team)]/30 text-[var(--color-red-team)]"
              }
            >
              Red
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Amount"
              className="border-[var(--color-gold)]/20 bg-[var(--color-navy)] text-center text-[var(--color-gold-light)]"
            />
          </div>

          <div className="flex justify-center gap-1">
            {[5, 10, 25].map((v) => (
              <Button
                key={v}
                size="xs"
                variant="outline"
                onClick={() => setAmount(String(Math.min(v, balance)))}
                className="border-[var(--color-gold)]/20 text-xs text-[var(--color-gold-light)]/60"
              >
                {v}
              </Button>
            ))}
            <Button
              size="xs"
              variant="outline"
              onClick={() => setAmount(String(balance))}
              className="border-[var(--color-gold)]/20 text-xs text-[var(--color-gold-light)]/60"
            >
              ALL
            </Button>
          </div>

          <div className="text-center text-xs text-[var(--color-gold-light)]/50">
            Balance: {balance}
          </div>

          <Button
            onClick={handleBet}
            disabled={!selectedSide || !amount || placing || pointsLoading}
            className="w-full bg-[var(--color-gold)] font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)] disabled:opacity-50"
          >
            {placing ? "Placing..." : pointsLoading ? "Loading..." : user ? "Place Bet" : "Login to Bet"}
          </Button>
        </div>
      )}
    </div>
  )
}
