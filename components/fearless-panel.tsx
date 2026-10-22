"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FlameIcon, PencilIcon, RotateCcwIcon, Trash2Icon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { HelpRows, InfoTip } from "@/components/ui/info-tip"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/session/confirm-dialog"
import { UNBAN_HELP, WIPE_FEARLESS_HELP, fearlessHelp } from "@/components/session/help"
import { findChampion, getChampionImageUrl } from "@/lib/champions"
import { cn } from "@/lib/utils"

interface FearlessPanelProps {
  refreshKey?: number
  signedIn?: boolean
  isAdmin?: boolean
}

const FEARLESS_KEY = ["fearless", "today"] as const
const PREVIEW_COUNT = 18

async function fetchFearless(): Promise<string[]> {
  const res = await fetch("/api/fearless", { cache: "no-store" })
  if (!res.ok) throw new Error("fearless")
  const body = await res.json()
  return Array.isArray(body) ? body.filter((c): c is string => typeof c === "string") : []
}

async function deleteFearless(champion: string | null) {
  const res = await fetch("/api/fearless", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(champion ? { champion } : {}),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(typeof body?.error === "string" ? body.error : "Could not update fearless bans")
  }
}

export function FearlessPanel({ refreshKey, signedIn = false, isAdmin = false }: FearlessPanelProps) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const query = useQuery({ queryKey: FEARLESS_KEY, queryFn: fetchFearless, staleTime: 15_000 })
  const { refetch } = query

  const seenKey = useRef(refreshKey)
  useEffect(() => {
    if (seenKey.current === refreshKey) return
    seenKey.current = refreshKey
    refetch()
  }, [refreshKey, refetch])

  const remove = useMutation({
    mutationFn: deleteFearless,
    onMutate: async (champion) => {
      await queryClient.cancelQueries({ queryKey: FEARLESS_KEY })
      const previous = queryClient.getQueryData<string[]>(FEARLESS_KEY)
      queryClient.setQueryData<string[]>(FEARLESS_KEY, (list) => (champion ? (list ?? []).filter((c) => c !== champion) : []))
      return { previous }
    },
    onSuccess: (_data, champion) => {
      toast.success(champion ? `${champion} is back in the pool.` : "Fearless list wiped. Every champion is fair game.")
      if (!champion) setConfirmClear(false)
    },
    onError: (error, _champion, context) => {
      if (context?.previous) queryClient.setQueryData(FEARLESS_KEY, context.previous)
      toast.error(error instanceof Error ? error.message : "Could not update fearless bans")
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["fearless"] }),
  })

  const champions = query.data ?? []
  const visible = expanded ? champions : champions.slice(0, PREVIEW_COUNT)
  const canEdit = signedIn && champions.length > 0
  const fearless = fearlessHelp()

  return (
    <section aria-labelledby="fearless-title" className="rounded-xl border border-border bg-card p-4">
      <header className="flex items-center gap-2">
        <FlameIcon className="size-4 text-[var(--color-gold)]" aria-hidden />
        <h2 id="fearless-title" className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-gold)]">
          Fearless bans
        </h2>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {query.isPending ? "" : `${champions.length} today`}
        </span>
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="size-10"
            aria-pressed={editing}
            aria-label={editing ? "Done editing fearless bans" : "Edit fearless bans"}
            onClick={() => setEditing((v) => !v)}
          >
            {editing ? <XIcon aria-hidden /> : <PencilIcon aria-hidden />}
          </Button>
        )}
      </header>

      {query.isPending ? (
        <div className="mt-3 flex flex-wrap gap-2" aria-label="Loading fearless bans">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="size-9 rounded-md" />
          ))}
        </div>
      ) : query.isError ? (
        <div className="mt-3 flex items-center justify-between gap-2 text-sm text-muted-foreground">
          The fearless ledger is unreadable right now.
          <Button variant="outline" className="h-10" onClick={() => refetch()}>
            <RotateCcwIcon aria-hidden />
            Retry
          </Button>
        </div>
      ) : champions.length === 0 ? (
        <p className="mt-3 flex items-start gap-1 text-sm text-muted-foreground">
          No bans yet today. Every champion is fair game until someone plays it.
          <InfoTip help={fearless} align="end" />
        </p>
      ) : (
        <>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            Played today, so they cannot be rolled again until tomorrow.
            <InfoTip help={fearless} align="end" />
          </p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {visible.map((name) => {
              const internal = findChampion(name)?.internal ?? name.replace(/[^A-Za-z]/g, "")
              return (
                <li key={name} className="relative">
                  <span className="block size-9 overflow-hidden rounded-md ring-1 ring-border" title={name}>
                    <Image
                      src={getChampionImageUrl(internal)}
                      alt={name}
                      width={36}
                      height={36}
                      unoptimized
                      className={cn("size-full scale-110 object-cover grayscale", !editing && "opacity-60")}
                    />
                  </span>
                  {editing && (
                    <button
                      type="button"
                      onClick={() => remove.mutate(name)}
                      disabled={remove.isPending}
                      aria-label={`Unban ${name}`}
                      className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-border bg-[var(--color-navy)] text-[var(--color-red-team)] shadow outline-none focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-2"
                    >
                      <XIcon className="size-3.5" aria-hidden />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {champions.length > PREVIEW_COUNT && (
              <Button variant="ghost" className="h-10 text-xs" onClick={() => setExpanded((v) => !v)}>
                {expanded ? "Show less" : `Show all ${champions.length}`}
              </Button>
            )}
            {editing && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                Tap a cross to unban a champion.
                <InfoTip help={UNBAN_HELP} />
              </span>
            )}
            {editing && isAdmin && (
              <Button
                variant="destructive"
                className="ml-auto h-10 text-xs"
                onClick={() => setConfirmClear(true)}
                disabled={remove.isPending}
              >
                <Trash2Icon aria-hidden />
                Wipe the list
              </Button>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Wipe today's fearless bans?"
        description={`All ${champions.length} champions go back into the pool for the next rolls. Games already played are not affected.`}
        confirmLabel="Wipe the list"
        destructive
        pending={remove.isPending}
        onConfirm={() => remove.mutate(null)}
      >
        <HelpRows help={WIPE_FEARLESS_HELP} />
      </ConfirmDialog>
    </section>
  )
}
