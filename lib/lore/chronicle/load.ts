import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingSchema } from "@/lib/db-errors"
import type { GazetteFacts } from "@/lib/lore/chronicle/facts"
import { writeGazette } from "@/lib/lore/chronicle/gazette"
import { compileNight, dedupeGames, latestNight } from "@/lib/lore/chronicle/night"
import {
  loadBets,
  loadDecrees,
  loadNetByUser,
  loadSalaxeGames,
  loadVotes,
  one,
  verdictNames,
  type GameRow,
  type ProfileRow,
  type SalaxeGameRow,
  type SessionRow,
  type VoteRow,
} from "@/lib/lore/chronicle/rows"
import type { ChronicleNight, ChronicleResponse } from "@/lib/lore/chronicle/types"
import { writeNight } from "@/lib/lore/chronicle/write"
import { isSalaxe } from "@/lib/lore/salaxe"

const RECENT_GAMES = 60
const RECENT_SESSIONS = 80
const ONGOING_MS = 3 * 60 * 60_000
const LEAD_IN_MS = 60 * 60_000
const TAIL_MS = 15 * 60_000
const DUPLICATE_MS = 5 * 60_000

const GAME_COLUMNS = "id, played_at, winner_side, game_players (player_id, side, lane, champion, players:player_id ( name ))"

function salaxeRecord(rows: SalaxeGameRow[], since: string | null): { wins: number; losses: number } | null {
  const from = since ? Date.parse(since) : Number.NEGATIVE_INFINITY
  const games = rows
    .map((row) => ({ side: row.side, game: one(row.games) }))
    .filter((r): r is { side: SalaxeGameRow["side"]; game: { played_at: string; winner_side: SalaxeGameRow["side"] } } => !!r.game)
    .filter((r) => Date.parse(r.game.played_at) >= from)
    .sort((a, b) => Date.parse(a.game.played_at) - Date.parse(b.game.played_at))
  let wins = 0
  let losses = 0
  let last: { at: number; won: boolean } | null = null
  for (const { side, game } of games) {
    const at = Date.parse(game.played_at)
    const won = side === game.winner_side
    if (last && at - last.at <= DUPLICATE_MS && last.won === won) continue
    last = { at, won }
    if (won) wins++
    else losses++
  }
  return wins + losses > 0 ? { wins, losses } : null
}

function latestVerdict(vote: VoteRow | null, playerName: (id: string) => string | null): GazetteFacts["verdict"] {
  if (!vote) return null
  const names = (category: "mvp" | "inter") => {
    const named = verdictNames(vote.summary?.[category]?.names)
    if (named.length > 0) return named
    const ids = (category === "mvp" ? vote.mvp_player_ids : vote.inter_player_ids) ?? []
    return ids.map(playerName).filter((n): n is string => !!n)
  }
  const join = (list: string[]) => (list.length > 0 ? list.join(" & ") : null)
  return { mvp: join(names("mvp")), inter: join(names("inter")) }
}

export async function loadChronicle(supabase: SupabaseClient, now = Date.now()): Promise<ChronicleResponse> {
  const [gamesRes, sessionsRes, profilesRes, playersRes, balancesRes, actRes, shameRes, verdictRes] = await Promise.all([
    supabase.from("games").select(GAME_COLUMNS).order("played_at", { ascending: false }).limit(RECENT_GAMES),
    supabase.from("game_sessions").select("id, status, game_id, created_at").order("created_at", { ascending: false }).limit(RECENT_SESSIONS),
    supabase.from("user_profiles").select("id, discord_username, players:player_id ( name )"),
    supabase.from("players").select("id, name"),
    supabase.from("point_balances").select("user_id, balance").order("balance", { ascending: false }),
    supabase.from("acts").select("act_number, started_at").eq("status", "active").maybeSingle(),
    supabase.from("shame_entries").select("target_player_id, created_at").order("created_at", { ascending: false }).limit(1000),
    supabase
      .from("post_game_votes")
      .select("session_id, status, mvp_player_ids, inter_player_ids, summary")
      .eq("status", "settled")
      .order("settled_at", { ascending: false })
      .limit(1),
  ])
  if (gamesRes.error) throw new Error(gamesRes.error.message)

  const playerNames = new Map(((playersRes.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]))
  const playerName = (id: string) => playerNames.get(id) ?? null
  const profileNames = new Map(
    ((profilesRes.data ?? []) as unknown as ProfileRow[]).map((p) => [p.id, one(p.players)?.name || p.discord_username || null])
  )
  const userName = (id: string) => profileNames.get(id) ?? null
  const salaxeId = [...playerNames.entries()].find(([, name]) => isSalaxe(name))?.[0] ?? null
  const actStart = (actRes.data as { started_at?: string } | null)?.started_at ?? null

  const sessions = (sessionsRes.data ?? []) as SessionRow[]
  const sessionByGame = new Map(sessions.filter((s) => s.game_id).map((s) => [s.game_id as string, s.id]))
  const nightGames = dedupeGames(latestNight((gamesRes.data ?? []) as unknown as GameRow[]), new Set(sessionByGame.keys()))

  const first = nightGames[0]
  const last = nightGames[nightGames.length - 1]
  const sessionIds = nightGames.map((g) => sessionByGame.get(g.id)).filter((id): id is string => !!id)
  const linkedStarts = sessions.filter((s) => sessionIds.includes(s.id)).map((s) => Date.parse(s.created_at))
  const windowStart = first
    ? new Date(Math.min(Date.parse(first.played_at) - LEAD_IN_MS, ...linkedStarts)).toISOString()
    : null
  const windowEnd = last ? new Date(Date.parse(last.played_at) + TAIL_MS).toISOString() : null

  const [bets, decrees, votes, net, salaxeGames] = await Promise.all([
    loadBets(supabase, sessionIds),
    loadDecrees(supabase, sessionIds),
    loadVotes(supabase, sessionIds),
    windowStart && windowEnd ? loadNetByUser(supabase, windowStart, windowEnd) : Promise.resolve(new Map<string, number>()),
    loadSalaxeGames(supabase, salaxeId),
  ])

  let night: ChronicleNight | null = null
  if (first && last && windowStart && windowEnd) {
    const ongoing = now - Date.parse(last.played_at) < ONGOING_MS
    const compiled = compileNight({
      id: first.id,
      ongoing,
      games: nightGames,
      sessionByGame,
      bets,
      decrees,
      votes,
      net,
      salaxeId,
      playerName,
      userName,
    })
    const written = writeNight(compiled.facts)
    const settled = bets.filter((b) => b.status === "won" || b.status === "lost")
    night = {
      id: first.id,
      startedAt: first.played_at,
      endedAt: last.played_at,
      ongoing,
      episode: written.episode,
      games: compiled.games,
      stats: {
        games: compiled.facts.games,
        blueWins: compiled.facts.blueWins,
        redWins: compiled.facts.redWins,
        canceled: sessions.filter((s) => {
          const at = Date.parse(s.created_at)
          return s.status === "canceled" && at >= Date.parse(windowStart) && at <= Date.parse(windowEnd)
        }).length,
        bets: settled.length,
        wagered: settled.reduce((sum, b) => sum + b.amount, 0),
        decrees: compiled.facts.decrees.count,
        decreeSpend: compiled.facts.decrees.spent,
        players: compiled.players,
      },
      entries: written.entries,
    }
  }

  const balances = (balancesRes.data ?? []) as { user_id: string; balance: number }[]
  const named = (row: { user_id: string; balance: number } | undefined) => {
    const name = row ? userName(row.user_id) : null
    return row && name ? { name, balance: row.balance } : null
  }
  const shameCounts = new Map<string, number>()
  const shameSince = actStart ? Date.parse(actStart) : Number.NEGATIVE_INFINITY
  for (const entry of (shameRes.data ?? []) as { target_player_id: string; created_at: string }[]) {
    if (Date.parse(entry.created_at) < shameSince) continue
    shameCounts.set(entry.target_player_id, (shameCounts.get(entry.target_player_id) ?? 0) + 1)
  }
  const topShamed = [...shameCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const verdictRow =
    verdictRes.error && isMissingSchema(verdictRes.error) ? null : (((verdictRes.data ?? []) as VoteRow[])[0] ?? null)

  const gazette = writeGazette({
    day: new Date(now).toISOString().slice(0, 10),
    leader: named(balances[0]),
    pauper: balances.length > 1 ? named(balances[balances.length - 1]) : null,
    salaxe: salaxeRecord(salaxeGames, actStart),
    shamed: topShamed && playerName(topShamed[0]) ? { name: playerName(topShamed[0])!, count: topShamed[1] } : null,
    verdict: latestVerdict(verdictRow, playerName),
  })

  return { generatedAt: new Date(now).toISOString(), night, gazette }
}
