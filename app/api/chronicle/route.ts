import { NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { loadChronicle } from "@/lib/lore/chronicle/load"
import type { ChronicleResponse } from "@/lib/lore/chronicle/types"

// Public data only: an anonymous client keeps the response free of cookies so the CDN can share it.
const CACHE_HEADERS = { "Cache-Control": "public, max-age=0, s-maxage=10, stale-while-revalidate=20" }
const FRESH_MS = 10_000
const MAX_SINCE_AGE_MS = 10 * 60_000

let client: SupabaseClient | null = null
let cached: { at: number; startedAt: number; body: ChronicleResponse } | null = null
let inflight: { startedAt: number; promise: Promise<ChronicleResponse> } | null = null

function anonClient(): SupabaseClient {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

// ?since=<event time>: the story changed at that moment, so only a load started after it is good enough.
function sinceOf(request: Request): number | null {
  const raw = new URL(request.url).searchParams.get("since")
  const at = raw ? Date.parse(raw) : Number.NaN
  if (!Number.isFinite(at)) return null
  const now = Date.now()
  return Math.min(Math.max(at, now - MAX_SINCE_AGE_MS), now)
}

function load(since: number | null): Promise<ChronicleResponse> {
  if (inflight && (since === null || inflight.startedAt >= since)) return inflight.promise
  const startedAt = Date.now()
  const promise = loadChronicle(anonClient())
    .then((body) => {
      if (!cached || cached.startedAt <= startedAt) cached = { at: Date.now(), startedAt, body }
      return body
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null
    })
  inflight = { startedAt, promise }
  return promise
}

export async function GET(request: Request) {
  const since = sinceOf(request)
  if (cached && (since === null ? Date.now() - cached.at < FRESH_MS : cached.startedAt >= since)) {
    return NextResponse.json(cached.body, { headers: CACHE_HEADERS })
  }
  try {
    return NextResponse.json(await load(since), { headers: CACHE_HEADERS })
  } catch {
    if (cached) return NextResponse.json(cached.body, { headers: CACHE_HEADERS })
    return NextResponse.json(
      { error: "The scribes could not reach the archives." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    )
  }
}
