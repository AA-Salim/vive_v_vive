import {
  deaccent,
  PRAISE_MAX_CHARS,
  PRAISE_MIN_CHARS,
  PRAISE_MIN_WORDS,
  PRAISE_REWARD,
  RIDDLE_DAILY_LIMIT,
  RIDDLE_FIRST_TRY_BONUS,
  ROYAL_FAVOR,
  VERDICT_NOTE_MAX,
} from "@/lib/praise/rules"
import type { JudgeErrorCode, RiddleErrorCode, RiddleKind, SubmitErrorCode } from "@/lib/praise/types"

export function seededPick<T>(list: readonly T[], seed: string): T {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return list[(hash >>> 0) % list.length]
}

export const PANEL_KICKERS = [
  "The hand-kissing era is over. Now it must be written.",
  "Salaxe stopped accepting kisses. He wants it in writing, signed.",
  "Words, not lips. The exiled king is collecting testimonies.",
  "The notebook has a new page: subjects who said something nice.",
]

export const COMPOSER_INTROS = [
  "Write it yourself. Name him. Mean it, or make it sound like you do.",
  "He will read every word, twice, then deny it moved him.",
  "No kisses, no copy-paste. Ink, honesty, and at least one of his names.",
]

const SUNG_GENERIC = [
  "He read it twice, then a third time, lips moving. Your name moves to the maybe-loyal column of the notebook.",
  "Finally, someone who puts it in writing. He will deny ever being moved. He was moved.",
  "The exiled king pretends not to care. He has already screenshotted it.",
  "He will frame this next to his participation trophy. It is a large frame.",
  "Chklat sniffs. Adequate, he says. Then he reads it again when he thinks nobody is looking.",
  "SLX nods slowly, like a man who has not been complimented since the 0/8 Yone game.",
  "EL Salaxino Goblino clutches the scroll to his chest. You are not getting it back.",
  "Le Bon Salaxe files your words under Evidence I Was Right All Along.",
  "Chalaksse would like it known that he expected nothing less. He expected nothing.",
  "The royal scribe archives it. Salaxe asks for a second copy, for safety.",
  "Something in his eye. Not a tear. The crown is heavy, even from the floor.",
  "Merci, mon fidèle sujet, he whispers, then pretends he said nothing at all.",
  "He reads it aloud to an empty throne room. The echo agrees with you.",
  "Your name is moved from the rebels page to the pending page. Progress.",
  "He nods once, the way a king nods when he has rehearsed nodding.",
]

const SUNG_KEYWORDS: { pattern: RegExp; lines: string[] }[] = [
  {
    pattern: /baron|nashor/,
    lines: [
      "He read the word Baron and flinched. The 0.3 seconds still haunt him. He accepts anyway.",
      "Baron mentioned. Salaxe stares at the pit where he once face-checked destiny, alone. Accepted.",
    ],
  },
  {
    pattern: /yone|0 ?\/ ?8|zero.?eight/,
    lines: [
      "Someone finally said it: the 0/8 Yone was a strategic sacrifice. He feels seen.",
      "He would like the record to show the Yone game was a setup for the next game. Accepted.",
    ],
  },
  {
    pattern: /delayed|victoire|retard/,
    lines: [
      "At last, a subject who understands. It was never a loss. It was a victory, delayed.",
      "He stamps it Delivered On Time. Unlike his wins.",
    ],
  },
  {
    pattern: /gank|jungl|pathing|smite/,
    lines: [
      "He would gank for you. He would arrive late, but he would gank.",
      "Your words are the first thing in weeks to reach his lane on time.",
    ],
  },
  {
    pattern: /flash/,
    lines: [
      "He flashed into a wall for this kingdom once. You noticed. That means everything.",
    ],
  },
  {
    pattern: /notebook|carnet/,
    lines: [
      "He opens the little notebook, finds your name, and writes forgiven, for now, next to it.",
    ],
  },
  {
    pattern: /ff ?15|surrender|forfeit/,
    lines: [
      "He never surrenders. He votes ff15 out of compassion for the enemy. You get it.",
    ],
  },
  {
    pattern: /goblin/,
    lines: [
      "EL Salaxino Goblino rubs his little hands together. He likes being called that. Tell no one.",
    ],
  },
  {
    pattern: /crown|throne|couronne|trone|reign|regne|(^|[^a-z])roi([^a-z]|$)/,
    lines: [
      "The crown is not lost. It is resting. Your words polish it.",
      "He glances at the empty throne, then at your scroll. For a moment, the throne looks less empty.",
      "He picks the crown up off the floor, reads your words, and puts it on. Slightly crooked. Still his.",
    ],
  },
]

export function sungResponse(body: string, seed: string): string {
  const text = deaccent(body)
  const themed = SUNG_KEYWORDS.find((group) => group.pattern.test(text))
  return seededPick(themed ? themed.lines : SUNG_GENERIC, seed)
}

const CROWN_LINES = [
  "Finally, a subject who can spell majesty.",
  "Royal Favor granted. He will pretend he did not enjoy reading this.",
  "Stamped with the royal seal. The seal is a sticker. It still counts.",
  "This one goes on the wall of the throne room. The throne room is his bedroom.",
  "The King approves. Do not let it go to your head. That is his job.",
]

const SCORN_LINES = [
  "He read it, sighed, and wrote your name in the notebook. In pen.",
  "He has seen more sincerity in an ff15 vote.",
  "Even the 0/8 Yone had more conviction.",
  "Rejected by the throne. The throne is on the floor, so that is saying something.",
  "He wanted poetry and you gave him a patch note.",
]

const PENDING_LINES = [
  "Awaiting the King's verdict. He reads slowly. On purpose.",
  "The scroll sits on his desk. He walks past it, pretending not to look.",
  "Not judged yet. Salaxe is consulting the notebook.",
]

export const SELF_PRAISE_LINE = "The King praised himself. The court abstains, the court sighs."

export function verdictLine(verdict: "crowned" | "scorned" | null, seed: string): string {
  if (verdict === "crowned") return seededPick(CROWN_LINES, seed)
  if (verdict === "scorned") return seededPick(SCORN_LINES, seed)
  return seededPick(PENDING_LINES, seed)
}

export const COOLDOWN_LINES = [
  "The quill rests until tomorrow. One praise a day keeps the exile fed.",
  "One song a day. Even a fallen king has standards. Low ones, but standards.",
  "He is still reading your last one. Lips moving.",
]

export const COPY = {
  title: "Sing His Praises",
  rewardBadge: `+${PRAISE_REWARD} a day`,
  compose: "Compose your praise",
  composerTitle: "A praise for the exiled king",
  scrollLabel: "Your praise for Salaxe",
  placeholder: "Begin with his name. He likes that.",
  sing: "Sing",
  singing: "Sealing the scroll...",
  shortcut: "Ctrl + Enter to sing",
  successTitle: "The King has heard you",
  successHint: `Salaxe may still crown it (+${ROYAL_FAVOR} Royal Favor) or scorn it in public. Watch the Hall.`,
  todayLabel: "Your song for today",
  nextSong: "Next song in",
  hallButton: "Open the Hall of Praise",
  hallTitle: "Hall of Praise",
  hallDescription: "Every word sung for the exiled king. He has read them all. Twice.",
  featuredCrowned: "Crowned by Salaxe",
  featuredLatest: "Latest song",
  loggedOutTitle: "Only sworn subjects may sing.",
  loggedOutBody: `Log in with Discord and earn ${PRAISE_REWARD} points a day for a few kind, written words.`,
  login: "Login with Discord",
  pendingTitle: "The court scribes are preparing the Hall of Praise.",
  pendingBody: "The quill returns shortly. No free kisses in the meantime.",
  errorTitle: "The royal messenger tripped on the stairs.",
  retry: "Try again",
  courtTitle: "Your court awaits",
  holdCourt: "Hold court",
  emptyLatest: "The Hall is silent. Be the first voice the exile hears.",
  emptyCrowned: "Nothing crowned yet. Salaxe is a harsh critic, and a slow reader.",
  emptyMine: `You have not sung yet. ${PRAISE_REWARD} points are waiting for a few honest lies.`,
  emptyCourt: "Nothing to judge. The court is quiet and the King is bored.",
  legacy: (count: number) =>
    `Before the quill: ${count} one-click ${count === 1 ? "kiss" : "kisses"}, archived with honor and zero literary merit.`,
}

const SUBMIT_MESSAGES: Record<SubmitErrorCode, string> = {
  too_short: `Too short. A king deserves at least ${PRAISE_MIN_CHARS} characters of worship.`,
  too_long: `Too long. Even Salaxe stops reading after ${PRAISE_MAX_CHARS} characters.`,
  too_few_words: `At least ${PRAISE_MIN_WORDS} words. He counts them. On his fingers.`,
  no_name: "You never named him. Salaxe, SLX, Chklat, Goblino: pick one.",
  keyboard_mash: "Keyboard mash detected. The royal scribe refuses to copy this.",
  repetitive: "Filler and repeats do not count. Give him real, varied words.",
  too_many_symbols: "Too many symbols. He wants words, not hieroglyphs.",
  prompt_copy: "That is the prompt, not a praise. Write your own words.",
  already_sung: "You already sang today. The quill rests until tomorrow.",
  duplicate: `That exact song was already sung. Originality is the price of ${PRAISE_REWARD} points.`,
  too_similar: "Too close to a praise already in the Hall. Change it up.",
  not_authenticated: "Only sworn subjects may sing. Log in first.",
  no_balance: "Your treasury is not open yet. Reload the page and try again.",
  riddle_required: "Solve the King's Riddle first. He wants proof of wit before praise.",
  invalid_input: "The scroll arrived torn. Try again.",
  migration_pending: "The court scribes are still preparing the Hall of Praise.",
  unknown: "The royal messenger tripped. Your praise was not delivered, nothing was charged.",
}

export function submitErrorMessage(code: SubmitErrorCode, matchName?: string | null): string {
  if (matchName && code === "too_similar") return `Too close to what ${matchName} already sang. Change it up.`
  if (matchName && code === "duplicate") return `${matchName} already sang those exact words. Originality is the price of ${PRAISE_REWARD} points.`
  return SUBMIT_MESSAGES[code]
}

const JUDGE_MESSAGES: Record<JudgeErrorCode, string> = {
  not_authenticated: "Log in first, Your Majesty.",
  not_salaxe: "Only the real Salaxe may judge. Nice try, usurper.",
  invalid_verdict: "Crown or scorn. There is no third option.",
  note_too_long: `Keep the royal remark under ${VERDICT_NOTE_MAX} characters.`,
  not_found: "That praise vanished from the Hall.",
  own_praise: "The King cannot judge his own praise. The court would never stop laughing.",
  already_judged: "The King already ruled on this one. His word is final.",
  crown_limit: "No crowns left today. Even royal favor runs dry.",
  author_unavailable: "That subject has no treasury to receive your favor.",
  invalid_input: "The decree arrived torn. Try again.",
  migration_pending: "The court scribes are still preparing the Hall of Praise.",
  unknown: "The decree got lost on the way. Nothing changed.",
}

export function judgeErrorMessage(code: JudgeErrorCode): string {
  return JUDGE_MESSAGES[code]
}

export const RIDDLE_COPY = {
  kicker: "The King tests your wit",
  stepRiddle: "The King's Riddle",
  stepOne: "The riddle",
  stepTwo: "Your praise",
  bonusBadge: `+${RIDDLE_FIRST_TRY_BONUS} first try`,
  sharpMind: "Sharp Mind",
  answer: "Answer the King",
  answering: "The King ponders...",
  skip: "Ask for another riddle",
  skipNote: "counts as a miss",
  next: "Now, sing his praises",
  solvedTitle: "The King is impressed",
  lockedTitle: "The King has heard enough guesses",
  lockedBody: `${RIDDLE_DAILY_LIMIT} riddles, ${RIDDLE_DAILY_LIMIT} misses. The quill stays dry until tomorrow. Salaxe is not angry, only disappointed.`,
  loading: "The King is thinking of a riddle...",
  connected: "Connected. The water reaches the throne.",
}

export const RIDDLE_INTROS = [
  "Before you praise him, prove you are worth hearing.",
  "Salaxe only reads praises from sharp minds. Or lucky ones.",
  "A riddle first. The exiled King has time. So much time.",
  "He solved this one in his head, he says. Mid-teamfight. He lost the fight.",
]

export const RIDDLE_PROMPTS: Record<RiddleKind, { title: string; question: string; lore: string }> = {
  sequence: {
    title: "The Royal Count",
    question: "What number comes next?",
    lore: "Salaxe counts his loyal subjects by a rule only he remembers.",
  },
  arrows: {
    title: "The Weathervane",
    question: "Where does the next arrow point?",
    lore: "The castle weathervane turns by royal decree. Read the pattern.",
  },
  maze: {
    title: "The Royal Plumbing",
    question: "Tap a pipe to turn it. Connect the entry to the exit.",
    lore: "The throne room is flooding again. Fix the pipes before he notices.",
  },
}

export const RIDDLE_CORRECT_LINES = [
  "Correct. Salaxe nods slowly, as if he knew all along.",
  "Sharp. Your name moves to the clever column of the notebook.",
  "Right answer. The King insists he solved it faster.",
  "Well reasoned. He will pretend that was easy.",
]

export const RIDDLE_MISS_LINES = [
  "Wrong. Salaxe sighs and scribbles a new riddle.",
  "Not quite. The King poses another, slower this time.",
  "Even the 0/8 Yone saw that coming. Here is another.",
  "The court winces. Try this one instead.",
]

export const RIDDLE_SKIP_LINES = [
  "The King tears up the riddle and writes a new one. Easier, he claims.",
  "Fine, another riddle. He sighs loudly enough for the whole court.",
]

const RIDDLE_MESSAGES: Record<RiddleErrorCode, string> = {
  not_authenticated: "Only sworn subjects may answer the King. Log in first.",
  no_riddle: "The riddle crumbled at midnight. Here is a fresh one.",
  riddle_limit: "No riddles left today. The quill rests until tomorrow.",
  invalid_answer: "The King could not read that answer. Try again.",
  invalid_input: "The King could not read that answer. Try again.",
  migration_pending: "The King is still writing his riddles.",
  unknown: "The royal messenger tripped. Your answer was not delivered.",
}

export function riddleErrorMessage(code: RiddleErrorCode): string {
  return RIDDLE_MESSAGES[code]
}
