// The insult filter, mirrored line for line in supabase/phase10_praise.sql (praise_insult_stems, praise_insult),
// which decides. Keep both lists and both algorithms identical.
//
// Each stem starts with its mode:
//   =  whole token        short or common stems (mok, tg, pd, nul, con)
//   ^  token prefix       short stems that only take endings (nik, zb, wld, w9, 5to, kelb)
//   ~  compact substring  long, distinctive stems that survive any split (charmouta, 9ahba, putain)
// Tokens are matched three ways: split on every symbol, glued across symbols ("z.a.m.l", "z-a-m-l") and runs of
// single letters glued back together ("z a m l"). Repeated letters collapse first ("zaaaml", "nikkk"), so stems
// are written collapsed: "conard" for connard, "nob" for noob (a whole token, so "noble" passes).
// "nul" is a whole token only ("nulle part", "nullement" pass), and never in the French "nul ne" (nobody).
// Known misses, by choice: Nike or Nikola trip "nik", and "kalbi" (my heart, in some dialects) trips "kalb".
export const INSULT_STEMS: readonly string[] = [
  // Darija
  "^zaml", "^zamel", "^zamal", "^zmel", "^zml", "^zwaml", "^zwamel",
  "^5to", "^khto", "^5tk", "^khtk", "^khtek", "^5tek", "^o5t", "^okht", "=5tak", "=khtak",
  "^w9", "^wqi7", "^wqa7",
  "^wld", "^wlid", "^wlad",
  "~9ahba", "~qahba", "~kahba", "~9a7ba", "~qa7ba", "~ka7ba", "~9e7ba", "~9hba", "~q7ba", "~9hab", "~q7ab", "~qhab", "^3ahir",
  "^zb", "^zebi", "=zeb", "^zob",
  "^nik", "^nayk", "^nayek", "^n7wi", "^nhwi", "^tnyak", "^tnayk", "^tnik", "^mnyo", "^manyo", "^t7wa",
  "~9awed", "~qawed", "~9awd", "~qawd", "~9wd", "=qwd", "^9wad", "^qwad", "^m9wd",
  "=mok", "=tmok", "=mk", "=mouk",
  "^zok", "=zk",
  "^7mar", "^hmar", "^7mir", "^hmir", "^7imar", "^himar",
  "^kelb", "^klb", "^kalb", "^kleb", "^klab",
  "^bghel", "^bghl", "^bghal", "^b8el",
  "~9lawi", "~qlawi", "^klawi", "^9lwa", "^qlwa",
  "^terma", "^tirma",
  "=5ra", "=khra", "=khara", "=5ara", "^5rya", "^khrya", "^5raw", "^khraw",
  "^tfou", "=tfo", "=tfu",
  "~charmout", "~sharmout", "~chermout", "~charmot", "~sharmot", "~chermot", "~charmut", "~sharmut",
  "^manyak", "^maniak",
  "^khanz", "^5anz", "^7ayawan", "^hayawan", "^9erd", "^qerd", "^9ird", "^qird",
  "^halouf", "^7alouf", "^hlouf", "^7louf", "^ghbi", "^ghabi", "^tbon", "^tboun",
  "^mskhot", "^mskhout", "^msakh", "^mse5", "^msa5",
  // French
  "^pute", "~putain", "=ptn", "^fdp", "^ntm", "^niqu", "^encul", "=con", "=cons", "=conne", "^conar", "^conas",
  "^coner", "^salop", "^merd", "^emerd", "^batar", "^abrut", "^debil", "=tg", "~tagueule", "=pd", "=pede",
  "=nul", "=nuls", "^nulos", "^nulard", "=cul", "^boufon", "^tocar", "^minabl", "^pouri", "=cassos", "^baltring",
  "=teube", "=golmon", "^fiot", "^enfoir", "^ordur", "^raclur", "=chier", "=naze",
  // English
  "~fuck", "^fuk", "^fck", "^fvck", "^shit", "^bulshit", "=sht", "^bitch", "^biatch", "^btch", "^ashol", "^dick",
  "=nob", "=nobs", "=newb", "=nub", "^trash", "^idiot", "^stupid", "^loser", "^clown", "^dumb", "^moron", "^bastar",
  "^cunt", "^wank", "=twat", "=bozo", "^suck", "^garbag", "^pathetic", "^feeder", "=inting", "^hardstuck", "^jerk",
  "=ugly",
]

const HOMOGLYPHS_FROM = "аеорсхуікмтвнѕјАЕОРСХУІКМТВНЅЈαεικνορτυχΑΕΙΚΝΟΡΤΥΧ"
const HOMOGLYPHS_TO = "aeopcxyikmtbhsjaeopcxyikmtbhsjaeikvoptuxaeiknoptyx"

function translate(text: string, from: string, to: string): string {
  const source = Array.from(from)
  const target = Array.from(to)
  return Array.from(text, (char) => {
    const index = source.indexOf(char)
    return index === -1 ? char : (target[index] ?? "")
  }).join("")
}

function fold(text: string): string {
  const stripped = text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\u0153\u0152]/g, "oe")
    .replace(/[\u00e6\u00c6]/g, "ae")
    .replace(/\u00df/g, "ss")
  return translate(stripped, HOMOGLYPHS_FROM, HOMOGLYPHS_TO).toLowerCase()
}

const collapse = (text: string) => text.replace(/(.)\1+/g, "$1")

// The Darija pass keeps 3, 5, 7 and 9 (they are letters in Arabizi); the Latin pass also reads 3 as e and 5 as s.
const PASSES: readonly [string, string][] = [
  ["4@01$", "aaois"],
  ["4@01$35", "aaoises"],
]

function stemHit(entry: string, tokens: string[], compact: string): boolean {
  const stem = entry.slice(1)
  if (entry[0] === "=") return tokens.includes(stem)
  if (entry[0] === "^") return tokens.some((token) => token.startsWith(stem))
  return compact.includes(stem)
}

// The first insult stem found in the text, or null.
export function findInsult(text: string): string | null {
  const folded = fold(text)
  for (const [from, to] of PASSES) {
    const pass = translate(folded, from, to).replace(/(^|[^a-z0-9])nul([^a-z0-9]+ne)(?![a-z0-9])/g, "$1$2")
    const split = pass.split(/[^a-z0-9]+/).filter(Boolean).map(collapse)
    const tokens = [
      ...split,
      ...pass
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(Boolean)
        .map(collapse),
    ]
    let run = ""
    for (const token of [...split, ""]) {
      if (token.length === 1) {
        run += token
        continue
      }
      if (run.length > 1) tokens.push(collapse(run))
      run = ""
    }
    const compact = collapse(pass.replace(/[^a-z0-9]/g, ""))
    const hit = INSULT_STEMS.find((entry) => stemHit(entry, tokens, compact))
    if (hit) return hit.slice(1)
  }
  return null
}
