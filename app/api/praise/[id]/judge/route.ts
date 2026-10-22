import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase"
import { isMissingSchema, migrationPending } from "@/lib/db-errors"
import { emitLive, getActor } from "@/lib/live/server"
import { VERDICT_NOTE_MAX } from "@/lib/praise/rules"
import { asJudgeError, judgeFailure, loadAuthors, toPraiseView, type JudgeRpcResult } from "@/lib/praise/server"
import type { JudgeResult } from "@/lib/praise/types"
import { noteText, parseNotes } from "@/lib/titles/effects"

const JudgeBody = z.object({
  verdict: z.enum(["crowned", "scorned"]),
  note: z.string().max(VERDICT_NOTE_MAX * 2).nullish(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) return judgeFailure("not_found")

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return judgeFailure("not_authenticated")

  const parsed = JudgeBody.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return judgeFailure("invalid_input")

  const note = parsed.data.note?.replace(/\s+/g, " ").trim() || null
  if (note && Array.from(note).length > VERDICT_NOTE_MAX) return judgeFailure("note_too_long")

  const { data, error } = await supabase.rpc("judge_praise", {
    p_praise_id: id,
    p_verdict: parsed.data.verdict,
    p_note: note,
  })
  if (error) {
    if (isMissingSchema(error)) return migrationPending("Sing His Praises")
    return judgeFailure("unknown")
  }

  const result = data as JudgeRpcResult
  if (!result.ok) return judgeFailure(asJudgeError(result.error))

  const [authors, actor] = await Promise.all([
    loadAuthors(supabase, [result.praise.user_id]),
    getActor(supabase, user.id),
  ])
  const praise = toPraiseView(result.praise, authors)
  const notes = parseNotes(result.title_effects)

  emitLive("praise.judged", {
    actor,
    data: {
      verdict: result.praise.verdict ?? parsed.data.verdict,
      authorName: praise.author.name,
      delta: praise.favor,
      authorUserId: praise.author.userId,
      praiseId: praise.id,
      note: praise.verdictNote,
      titleEffects: notes.length ? notes.map(noteText) : undefined,
    },
  })

  return NextResponse.json({ praise, crownsLeft: result.crowns_left } satisfies JudgeResult)
}
