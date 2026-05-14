"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase-client"
import { useAuth } from "@/hooks/use-auth"
import { usePoints } from "@/hooks/use-points"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { DebtPledgeDialog } from "@/components/debt-pledge-dialog"
import { toast } from "sonner"
import Image from "next/image"
import type { BettingPool, Side } from "@/lib/types"

interface BettingPanelProps {
  sessionId: string
  isBettingOpen?: boolean
}

export function BettingPanel({ sessionId, isBettingOpen = true }: BettingPanelProps) {
  const { user, signIn } = useAuth()
  const { balance, isLoading: pointsLoading, refetch: refetchPoints } = usePoints(user?.id ?? null)
  const [pool, setPool] = useState<BettingPool | null>(null)
  const [selectedSide, setSelectedSide] = useState<Side | null>(null)
  const [amount, setAmount] = useState("")
  const [wantInsurance, setWantInsurance] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [insuring, setInsuring] = useState(false)
  const [debtPledgeOpen, setDebtPledgeOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null)
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
          event: "*",
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

  const doBet = async () => {
    const numAmount = parseInt(amount, 10)
    setPlacing(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/bets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side: selectedSide, amount: numAmount, insured: wantInsurance }),
      })
      if (res.ok) {
        const msg = wantInsurance
          ? `Bet placed: ${numAmount} on ${selectedSide} (insured)`
          : `Bet placed: ${numAmount} on ${selectedSide}`
        toast.success(msg)
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

  const handleBet = () => {
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
    const totalCost = numAmount + (wantInsurance ? 17 : 0)
    if (balance - totalCost < -300) {
      toast.error("Debt limit reached (-300 max)")
      return
    }

    if (balance < 0) {
      setPendingAction(() => doBet)
      setDebtPledgeOpen(true)
    } else {
      doBet()
    }
  }

  const doInsure = async () => {
    if (!user) return
    setInsuring(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/bets`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        toast.success("Bet insured! 50% loss protection active")
        await fetchPool()
        await refetchPoints()
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to insure bet")
      }
    } catch {
      toast.error("Failed to insure bet")
    } finally {
      setInsuring(false)
    }
  }

  const handleBuyInsurance = () => {
    if (!user) return
    if (balance < 0) {
      setPendingAction(() => doInsure)
      setDebtPledgeOpen(true)
    } else {
      doInsure()
    }
  }

  if (!pool) return null

  const hasBet = !!pool.user_bet
  const blueBets = pool.bets?.filter((b) => b.side === "blue") ?? []
  const redBets = pool.bets?.filter((b) => b.side === "red") ?? []
  const hasBets = blueBets.length > 0 || redBets.length > 0

  const numAmount = parseInt(amount, 10) || 0
  const totalCost = numAmount + (wantInsurance ? 17 : 0)
  const canAffordInsurance = balance - numAmount - 17 >= -300

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

      {hasBets && (
        <div className="mt-4 space-y-2">
          <div className="text-center text-xs font-semibold tracking-wider text-[var(--color-gold)]/70">
            BETS PLACED
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              {blueBets.map((bet) => (
                <div
                  key={bet.id}
                  className="flex items-center gap-2 rounded-md bg-[var(--color-blue-team)]/10 px-2.5 py-1.5"
                >
                  {bet.discord_avatar_url ? (
                    <Image
                      src={bet.discord_avatar_url}
                      alt=""
                      width={20}
                      height={20}
                      className="shrink-0 rounded-full"
                      unoptimized
                    />
                  ) : (
                    <div className="h-5 w-5 shrink-0 rounded-full bg-[var(--color-blue-team)]/30" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-gold-light)]/80">
                    {bet.discord_username}
                  </span>
                  <div className="flex shrink-0 items-center gap-1 text-xs font-bold">
                    <span className="text-[var(--color-blue-team)]">{bet.amount}</span>
                    {bet.insured && (
                      <span className="text-emerald-400/70" title="Insured">S</span>
                    )}
                    {bet.status === "won" && bet.payout != null && (
                      <span className="text-green-400">+{bet.payout}</span>
                    )}
                    {bet.status === "lost" && bet.insured && bet.payout != null && bet.payout > 0 && (
                      <span className="text-yellow-400">-{bet.amount - bet.payout}</span>
                    )}
                    {bet.status === "lost" && (!bet.insured || !bet.payout) && (
                      <span className="text-red-400/60">-{bet.amount}</span>
                    )}
                  </div>
                </div>
              ))}
              {blueBets.length === 0 && (
                <div className="py-2 text-center text-xs text-[var(--color-gold-light)]/30">
                  No bets
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              {redBets.map((bet) => (
                <div
                  key={bet.id}
                  className="flex items-center gap-2 rounded-md bg-[var(--color-red-team)]/10 px-2.5 py-1.5"
                >
                  {bet.discord_avatar_url ? (
                    <Image
                      src={bet.discord_avatar_url}
                      alt=""
                      width={20}
                      height={20}
                      className="shrink-0 rounded-full"
                      unoptimized
                    />
                  ) : (
                    <div className="h-5 w-5 shrink-0 rounded-full bg-[var(--color-red-team)]/30" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs text-[var(--color-gold-light)]/80">
                    {bet.discord_username}
                  </span>
                  <div className="flex shrink-0 items-center gap-1 text-xs font-bold">
                    <span className="text-[var(--color-red-team)]">{bet.amount}</span>
                    {bet.insured && (
                      <span className="text-emerald-400/70" title="Insured">S</span>
                    )}
                    {bet.status === "won" && bet.payout != null && (
                      <span className="text-green-400">+{bet.payout}</span>
                    )}
                    {bet.status === "lost" && bet.insured && bet.payout != null && bet.payout > 0 && (
                      <span className="text-yellow-400">-{bet.amount - bet.payout}</span>
                    )}
                    {bet.status === "lost" && (!bet.insured || !bet.payout) && (
                      <span className="text-red-400/60">-{bet.amount}</span>
                    )}
                  </div>
                </div>
              ))}
              {redBets.length === 0 && (
                <div className="py-2 text-center text-xs text-[var(--color-gold-light)]/30">
                  No bets
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {isBettingOpen && hasBet && (
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
            {pool.user_bet!.insured && (
              <span className="ml-2 text-xs text-emerald-400">(Insured)</span>
            )}
          </div>
          {!pool.user_bet!.insured && (
            <Button
              onClick={handleBuyInsurance}
              disabled={insuring || balance - 17 < -300}
              size="sm"
              variant="outline"
              className="mt-2 border-emerald-500/30 text-xs text-emerald-400 hover:border-emerald-500/60"
            >
              {insuring ? "Insuring..." : "Insure (17 pts) — 50% loss protection"}
            </Button>
          )}
        </div>
      )}

      {isBettingOpen && !hasBet && (
        <div className="mt-4 space-y-3">
          {user && (
            <div className="text-center text-sm font-semibold text-[var(--color-gold)]">
              {pointsLoading ? "..." : balance} points
            </div>
          )}

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

          {/* Insurance option */}
          {user && numAmount > 0 && (
            <div className="flex items-center justify-center gap-2">
              <Checkbox
                id="insurance"
                checked={wantInsurance}
                onCheckedChange={(checked) => setWantInsurance(!!checked)}
                disabled={!canAffordInsurance}
              />
              <label
                htmlFor="insurance"
                className="cursor-pointer text-xs text-emerald-400/80"
              >
                Insure (+17 pts) — recovers 50% on loss
              </label>
            </div>
          )}

          {user && wantInsurance && numAmount > 0 && (
            <div className="text-center text-xs text-[var(--color-gold-light)]/50">
              Total: {numAmount} + 17 = {totalCost} pts
            </div>
          )}

          {!user && (
            <p className="text-center text-xs text-[var(--color-gold-light)]/40">
              Login with Discord to place bets
            </p>
          )}
          {user && !pointsLoading && balance <= -300 && (
            <p className="text-center text-xs text-red-400">
              Debt limit reached (-300). Claim your daily bonus!
            </p>
          )}
          {user && !pointsLoading && balance > -300 && !selectedSide && (
            <p className="text-center text-xs text-[var(--color-gold-light)]/40">
              Select a side above to bet
            </p>
          )}
          {user && !pointsLoading && balance > -300 && selectedSide && !amount && (
            <p className="text-center text-xs text-[var(--color-gold-light)]/40">
              Enter an amount to bet
            </p>
          )}

          <Button
            onClick={user ? handleBet : signIn}
            disabled={user ? (!selectedSide || !amount || placing || pointsLoading || balance - totalCost < -300) : false}
            className="w-full bg-[var(--color-gold)] font-bold text-[var(--color-navy)] hover:bg-[var(--color-gold-dark)] disabled:opacity-50"
          >
            {!user
              ? "Login to Bet"
              : placing
                ? "Placing..."
                : pointsLoading
                  ? "Loading balance..."
                  : wantInsurance
                    ? `Place Bet (${totalCost} pts)`
                    : "Place Bet"}
          </Button>
        </div>
      )}

      <DebtPledgeDialog
        open={debtPledgeOpen}
        onOpenChange={setDebtPledgeOpen}
        currentBalance={balance}
        onConfirm={() => {
          if (pendingAction) {
            pendingAction()
            setPendingAction(null)
          }
        }}
      />
    </div>
  )
}
