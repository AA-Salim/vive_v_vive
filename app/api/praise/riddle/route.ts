import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { isMissingSchema, migrationPending } from "@/lib/db-errors"
import { RIDDLE_DAILY_LIMIT } from "@/lib/praise/rules"
import { asRiddleError, riddleFailure, toRiddle, toRiddleView, type RiddleRpcResult } from "@/lib/praise/server"
import type { RiddleSolveResult, RiddleState } from "@/lib/praise/types"

const NO_STORE = { "Cache-Control": "no-store" }

const SolveBody = z.strictObject({
  number: z.number().int().min(1).max(RIDDLE_DAILY_LIMIT),
  answer: z.union([
    z.strictObject({ value: z.number().int().min(0).max(1_000_000) }),
    z.strictObject({ rotations: z.array(z.number().int().min(0).max(3)).min(4).max(64) }),
    z.strictObject({ skip: z.literal(true) }),
  ]),
})

// Today's riddle for the signed-in user (posed on first call). Only the public half ever leaves the database.
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return riddleFailure("not_authenticated")

  const { data, error } = await supabase.rpc("get_my_riddle")
  if (error) {
    if (isMissingSchema(error)) return NextResponse.json({ available: false } satisfies RiddleState, { headers: NO_STORE })
    return riddleFailure("unknown")
  }

  const result = data as RiddleRpcResult
  if (!result.ok) return riddleFailure(asRiddleError(result.error))
  return NextResponse.json({ available: true, ...toRiddleView(result) } satisfies RiddleState, { headers: NO_STORE })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return riddleFailure("not_authenticated")

  const parsed = SolveBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return riddleFailure("invalid_input")

  const { number, answer } = parsed.data
  const { data, error } = await supabase.rpc("solve_my_riddle", { p_answer: { number, ...answer } })
  if (error) {
    if (isMissingSchema(error)) return migrationPending("The King's Riddle")
    return riddleFailure("unknown")
  }

  const result = data as RiddleRpcResult
  if (!result.ok) return riddleFailure(asRiddleError(result.error))

  const previous = result.previous
  return NextResponse.json(
    {
      outcome: result.result ?? "stale",
      view: toRiddleView(result),
      previous: previous ? { riddle: toRiddle(previous.kind, previous.puzzle), solution: previous.solution } : null,
    } satisfies RiddleSolveResult,
    { headers: NO_STORE }
  )
}
