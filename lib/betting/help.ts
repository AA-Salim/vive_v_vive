import { MARKET_COPY } from "@/lib/betting/copy"
import { formatMultiplier, formatSigned, otherSide, sideLabel, type Projection } from "@/lib/betting/math"
import { BET_RULES as R, HALL_RULES } from "@/lib/betting/rules"
import type { BetRow, HallOfFame, MarketResult, RulesVersion } from "@/lib/betting/types"
import { FREE, pct, pts, type HelpEntry } from "@/lib/help"
import { BETTING_DURATION_MS } from "@/lib/session/constants"
import type { Side } from "@/lib/types"

const percent = (value: number) => pct(value / 100)
const stakeOf = (points: number) => `${points.toLocaleString("en-US")}-point stake`
const poolOf = (points: number) => `${points.toLocaleString("en-US")}-point pool`

function duration(seconds: number): string {
  if (seconds % 60 !== 0) return `${seconds} seconds`
  const minutes = seconds / 60
  return `${minutes} minute${minutes === 1 ? "" : "s"}`
}

const WINDOW = duration(BETTING_DURATION_MS / 1000)
const PREMIUM_RATE = (R.coveragePct * R.premiumLoadPct) / 100
const PREMIUM_FORMULA = `The rate is ${percent(PREMIUM_RATE)} of the other side's share of the pool (your stake counted), kept between ${percent(R.premiumPct)} and ${percent(R.premiumMaxPct)}.`
const REFUNDED_IN_FULL = "Every stake and every insurance premium comes back in full."
const PERKS_APART = "Title perks and curses settle separately after the game."

export function marketHelp(rules: RulesVersion): HelpEntry {
  return {
    title: MARKET_COPY.title,
    does: "Bet points on Blue or Red before the game starts. Every stake goes into one pool, and the side that wins splits all of it.",
    cost:
      rules === 2
        ? "Your stake, plus a premium if you hire the Guardian Angel."
        : `Your stake, plus ${pts(R.legacyPremium)} if you insure it.`,
    reward:
      rules === 2
        ? "Stake x your side's final odds, plus the early conviction and all-in boosts."
        : "Stake x your side's final odds.",
    limits: `One bet per game, on one side. The window lasts ${WINDOW}. If one side ends with no bets, or the game is called off, everyone is refunded.`,
  }
}

interface PoolState {
  blue: number
  red: number
  blueMultiplier: number | null
  redMultiplier: number | null
}

export function oddsHelp(pool: PoolState): HelpEntry {
  const total = pool.blue + pool.red
  const example =
    pool.blueMultiplier != null
      ? `Blue at ${formatMultiplier(pool.blueMultiplier)} means each point on Blue comes back as ${pool.blueMultiplier.toFixed(2)} if Blue wins.`
      : "x2.00 means each point on that side comes back as 2 if it wins."
  return {
    title: "Pari-mutuel odds",
    does: `No bookmaker sets the price: a side's odds are the whole pool divided by the points on that side. ${example}`,
    cost: "Free to watch. A bet costs exactly its stake.",
    reward:
      total > 0
        ? `Stake x final odds, rounded down. Right now Blue pays ${formatMultiplier(pool.blueMultiplier)} and Red ${formatMultiplier(pool.redMultiplier)} on a ${poolOf(total)}.`
        : "Stake x final odds, rounded down. No bets yet, so no odds.",
    limits: "Odds move with every bet and only the final pool counts. A side with no bets shows x--: if it stays empty, everyone is refunded.",
  }
}

interface SlipHelpInput {
  rules: RulesVersion
  mode: "new" | "raise"
  side: Side | null
  projection: Projection | null
}

export function betHelp({ rules, mode, side, projection }: SlipHelpInput): HelpEntry {
  const raise = mode === "raise"
  const p = projection && projection.add > 0 ? projection : null
  const premiumName = rules === 2 ? "Guardian Angel premium" : "insurance"
  const cost = p
    ? `${pts(p.cost)} now: ${pts(p.add)} ${raise ? "added" : "stake"}${p.premiumAdd > 0 ? ` + ${pts(p.premiumAdd)} ${premiumName}` : ""}.`
    : raise
      ? "The points you add, plus the premium on them if your bet is insured."
      : "The stake you choose, plus the premium if you insure it."
  let reward = "Stake x your side's final odds, rounded down, plus any boost. A loss pays nothing unless insured."
  if (p && side && !p.oneSided) {
    const back = p.win.payout + p.win.early + p.win.allIn
    const boosted = p.win.early + p.win.allIn > 0 ? " with boosts" : ""
    const cover = p.lose.coverage > 0 ? `, except ${pts(p.lose.coverage)} from insurance` : ""
    reward = `${raise ? `Your ${stakeOf(p.stake)} pays` : "Pays"} ${pts(back)} if ${sideLabel(side)} wins at the current ${formatMultiplier(p.multiplier)}${boosted}. Nothing if it loses${cover}.`
  } else if (p?.oneSided && side) {
    reward = `Nobody is on ${sideLabel(otherSide(side))} yet. If it stays that way, the stake is refunded.`
  }
  return {
    title: raise ? "Raise the stakes" : "Place a bet",
    does: raise
      ? "Adds points to your bet, same side. The new points join the pool now and the whole stake is paid at the final odds."
      : "Puts your stake on the side you picked. The points leave your purse now and come back multiplied if that side wins.",
    cost,
    reward,
    limits: raise
      ? `While the window is open. All-in bets cannot be raised. Points added in the first ${R.earlySeconds} seconds earn the early boost.`
      : "One bet per game. Your side is locked once placed: you can raise it, never switch. Betting shuts when the timer hits zero.",
  }
}

export function earlyHelp(bonus = 0): HelpEntry {
  return {
    title: MARKET_COPY.earlyTitle,
    does: `Points staked in the first ${R.earlySeconds} seconds of the window earn a boost if your side wins: +${R.earlyBonusPct}% of the profit those points make.`,
    cost: FREE,
    reward:
      bonus > 0
        ? `About ${pts(bonus)} at the current odds, on top of the pool payout.`
        : `+${R.earlyBonusPct}% of the early points' share of the profit, on top of the pool payout.`,
    limits: `Only on a win with a profit. Points added after the first ${R.earlySeconds} seconds do not get it. Never paid on a refund.`,
  }
}

export const LAST_CALL_HELP: HelpEntry = {
  title: MARKET_COPY.lastCall,
  does: `The final ${R.lastCallSeconds} seconds of the betting window. At zero the notebook shuts: no new bets, raises or insurance on this game.`,
  cost: FREE,
  limits: "The server clock decides. A bet that lands after the close is rejected and costs you nothing.",
}

export function allInHelp(rules: RulesVersion, purse: number | null, bonus = 0): HelpEntry {
  const stake = purse != null && purse > 0 ? `: ${pts(purse)} right now` : ""
  if (rules === 1) {
    return {
      title: MARKET_COPY.allInTitle,
      does: "Fills the stake with your whole purse in one tap.",
      cost: `Your entire purse${stake}.`,
      reward: "Stake x your side's final odds. No all-in bonus under the current rules.",
      limits: "Needs a purse above zero.",
    }
  }
  return {
    title: MARKET_COPY.allInTitle,
    does: `Shove your whole purse on one side. If it wins, the house adds +${R.allInBonusPct}% of your profit on top.`,
    cost: `Your entire purse${stake}.`,
    reward:
      bonus > 0
        ? `About ${pts(bonus)} extra at the current odds, on top of the pool payout.`
        : `+${R.allInBonusPct}% of the profit, on top of the pool payout.`,
    limits: `Needs ${pts(R.allInMin)} or more on the line (an existing stake counts) and a purse above zero. Cannot be insured or raised afterwards. A loss is read out to the court.`,
  }
}

interface GuardianQuote {
  rules: RulesVersion
  stake: number
  premium: number
  pct: number
  coverage: number
  loser: Side | null
  raising?: boolean
}

export function guardianHelp(q: GuardianQuote): HelpEntry {
  const loser = q.loser ? sideLabel(q.loser) : "the other side"
  if (q.rules === 1) {
    return {
      title: "Insurance",
      does: `Insures your bet: if your side loses, ${percent(R.legacyCoveragePct)} of your stake comes back.`,
      cost: `${pts(R.legacyPremium)} flat, paid with the bet.`,
      reward:
        q.stake > 0
          ? `${pts(q.coverage)} back if ${loser} wins. The ${R.legacyPremium} comes back if you win.`
          : `${percent(R.legacyCoveragePct)} of your stake back on a loss. The ${R.legacyPremium} comes back if you win.`,
      limits: "Bought together with the bet, not afterwards. Canceled or one-sided game: stake and premium both come back.",
    }
  }
  const cost =
    q.stake <= 0
      ? `From ${percent(R.premiumPct)} of your stake, paid now. ${PREMIUM_FORMULA}`
      : q.raising
        ? q.premium > 0
          ? `${pts(q.premium)} more now, ${percent(q.pct)} of the points you add. ${PREMIUM_FORMULA}`
          : "Already paid. A raise adds a premium on the new points only."
        : `${pts(q.premium)} now, ${percent(q.pct)} of your ${stakeOf(q.stake)}. ${PREMIUM_FORMULA}`
  return {
    title: MARKET_COPY.insuranceTitle,
    does: `Insurance for your bet: if your side loses, ${percent(R.coveragePct)} of the stake comes back. The more of the pool is against you, the more she charges.`,
    cost,
    reward:
      q.stake > 0
        ? `${pts(q.coverage)} back if ${loser} wins (${percent(R.coveragePct)} of the stake, rounded down). Nothing extra if you win.`
        : `${percent(R.coveragePct)} of your stake back if your side loses.`,
    limits: `Stakes of ${R.insuranceMin}+ only, never on an all-in. The premium is kept if you win. Canceled game or nobody on the other side: stake and premium both come back. Priced so it never pays for itself on average.`,
  }
}

export function insureLaterHelp(q: GuardianQuote): HelpEntry {
  return {
    ...guardianHelp(q),
    title: `Hire the ${MARKET_COPY.insuranceTitle}`,
    does: `Insures the bet you already placed, priced from the pool right now. If your side loses, ${percent(R.coveragePct)} of the stake comes back.`,
  }
}

export function purseHelp(maxStake: number | null): HelpEntry {
  return {
    title: "Your purse and the debt floor",
    does: `The points you can bet. Salaxe lends credit below zero, down to ${R.debtFloor}, once you swear his pledge.`,
    cost: FREE,
    limits: `Nothing can take your purse under ${pts(R.debtFloor)}. A bet that would leave you below zero asks for the pledge first.${maxStake != null ? ` Right now you can put in up to ${pts(maxStake)}.` : ""}`,
  }
}

export function pledgeHelp(balance: number, cost?: number, action = "purchase"): HelpEntry {
  return {
    title: "Salaxe's pledge",
    does: `Salaxe lends you points so your purse can go below zero, down to ${R.debtFloor}. Your debt is simply your negative purse.`,
    cost:
      cost != null
        ? `No extra points, only your pride. The ${action} costs ${pts(cost)} and leaves you at ${pts(balance - cost)}.`
        : "No extra points, only your pride.",
    limits: `Credit stops at ${R.debtFloor}: nothing can take you lower. No interest, your next winnings refill the hole. Every purchase that ends below zero needs a fresh oath.`,
  }
}

export function payoutHelp(side: Side, p: Projection, exact: boolean): HelpEntry {
  const other = sideLabel(otherSide(side))
  const back = p.win.payout + p.win.early + p.win.allIn
  const refund = p.legacyTerms && p.premiumTotal > 0 ? ` The ${p.premiumTotal} premium comes back too.` : ""
  return {
    title: exact ? "Final odds" : "What the notebook owes you",
    does: exact
      ? "Betting is closed, so these odds are final. They are paid as soon as the winner is declared."
      : "Your result if betting closed right now. Every new bet moves the odds until the timer hits zero.",
    cost: `${pts(p.stake)} staked${p.premiumTotal > 0 ? ` + ${pts(p.premiumTotal)} premium` : ""}${p.add > 0 ? ", once placed" : ", already paid"}.`,
    reward: p.oneSided
      ? `Nobody is on ${other} yet. If it stays that way, everything is refunded.`
      : `${pts(back)} back if ${sideLabel(side)} wins, net ${formatSigned(p.win.net)}.${refund} ${p.lose.coverage > 0 ? `${pts(p.lose.coverage)} back if ${other} wins.` : `Nothing back if ${other} wins.`}`,
    limits: `Payout = stake x total pool / your side's pool, rounded down, plus any boost. ${PERKS_APART}`,
  }
}

export function refundHelp(canceled: boolean): HelpEntry {
  return {
    title: canceled ? "Game called off" : "No contest",
    does: canceled
      ? "The game was canceled or expired before a winner was declared, so every wager on it is void."
      : "Only one side had bets, so there was nobody to win from. A one-sided pool pays nobody.",
    cost: FREE,
    reward: REFUNDED_IN_FULL,
    limits: "No boosts are paid. A refunded bet counts as 0 in the Gambling Hall.",
  }
}

export function settlementHelp(result: MarketResult): HelpEntry {
  return {
    title: "How the pool was paid",
    does: `The winners split the whole ${poolOf(result.total_pool)} in proportion to their stakes. Losing stakes went to them.`,
    cost: FREE,
    reward: `On top, from the house: ${pts(result.insurance_paid)} returned by insurance and ${pts(result.bonus_paid)} in early and all-in boosts.`,
    limits: `Every payout is rounded down. ${PERKS_APART}`,
  }
}

type SettledBet = Pick<BetRow, "status" | "amount" | "payout" | "insured" | "scheme" | "premium">

export function resultHelp(bet: SettledBet): HelpEntry {
  const kept = bet.scheme === "v2" ? bet.premium : bet.insured && bet.status === "lost" ? R.legacyPremium : 0
  return {
    title: "Your result",
    does: "The net change to your purse from this wager: everything that came back, minus your stake and the premium.",
    cost:
      bet.status === "refunded"
        ? `${pts(bet.amount)} staked, refunded along with any premium.`
        : `${pts(bet.amount)} staked${kept > 0 ? ` + ${pts(kept)} premium kept by the house` : ""}.`,
    reward: bet.status === "refunded" ? "Everything came back: net 0." : `${pts(bet.payout ?? 0)} came back.`,
    limits: PERKS_APART,
  }
}

export const FEED_HELP: HelpEntry = {
  title: "The notebook",
  does: "Every wager on this game, updated live. The tags show how each bet was made.",
  cost: FREE,
  limits: `Whale: a stake of ${R.whaleAmount}+. All-in: the whole purse. Insured: Guardian Angel hired. Early: placed in the first ${R.earlySeconds} seconds. Raised: topped up after placing.`,
}

const READS_ONLY = "Free: it only reads the notebook."

export const HALL_HELP: HelpEntry = {
  title: "The Gambling Hall",
  does: "Records, standings and the latest results, built from every settled wager. Switch between this Act and all time.",
  cost: READS_ONLY,
  limits: "Only settled bets count: open bets appear once their game is decided. A refunded bet counts as 0.",
}

const NET = "Net = everything paid back minus stakes and premiums, boosts included."

export const HALL_TOTALS_HELP: Record<"wagered" | "bets" | "bettors" | "recovered" | "bonus", HelpEntry> = {
  wagered: { title: "Wagered", does: "Total points staked on bets that were won or lost.", cost: READS_ONLY, limits: "Refunded stakes are left out." },
  bets: { title: "Bets", does: "How many wagers have been settled.", cost: READS_ONLY, limits: "Refunded bets included." },
  bettors: { title: "Bettors", does: "How many people have at least one settled wager.", cost: READS_ONLY },
  recovered: {
    title: "Saved by insurance",
    does: "Points paid back by insurance on lost bets.",
    cost: READS_ONLY,
    limits: `The Guardian Angel returns ${percent(R.coveragePct)} of a lost stake, the old insurance ${percent(R.legacyCoveragePct)}.`,
  },
  bonus: {
    title: "Boosts paid",
    does: `Early conviction (+${R.earlyBonusPct}%) and all-in (+${R.allInBonusPct}%) bonuses paid on winning bets.`,
    cost: READS_ONLY,
    limits: "Paid by the house on top of the pool.",
  },
}

export const HALL_RECORD_HELP: Record<keyof HallOfFame["records"], HelpEntry> = {
  chosen: {
    title: "Chalaksse's Chosen",
    does: "The bettor with the highest total net profit from wagers.",
    cost: READS_ONLY,
    limits: `${NET} Must be above 0.`,
  },
  fool: {
    title: "The Royal Fool",
    does: "The bettor with the biggest total net loss from wagers.",
    cost: READS_ONLY,
    limits: `${NET} Must be below 0.`,
  },
  heist: {
    title: "The Heist",
    does: "The biggest net profit on a single winning bet.",
    cost: READS_ONLY,
    limits: "Boosts count, the premium is deducted.",
  },
  throw: {
    title: "The Baron Throw",
    does: "The biggest net loss on a single bet.",
    cost: READS_ONLY,
    limits: "Stake plus premium, minus anything insurance returned.",
  },
  high_roller: {
    title: "The High Roller",
    does: "The largest single stake on a bet that was won or lost.",
    cost: READS_ONLY,
    limits: "Refunded bets do not count. The caption shows how it ended.",
  },
  degenerate: {
    title: "The Degenerate",
    does: "The bettor with the most settled wagers.",
    cost: READS_ONLY,
    limits: "Refunded bets count. The caption shows the points wagered on decided bets.",
  },
  oracle: {
    title: "The Oracle",
    does: "The best win rate: bets won out of bets won or lost.",
    cost: READS_ONLY,
    limits: `Needs at least ${HALL_RULES.oracleMinDecided} decided bets. Refunds do not count.`,
  },
  angel: {
    title: "Saved by the Angel",
    does: "The bettor who got the most points back from insurance on lost bets.",
    cost: READS_ONLY,
    limits: "Counts Guardian Angel and old insurance payouts.",
  },
  boots: {
    title: "Boots On",
    does: "The bettor with the most all-in bets.",
    cost: READS_ONLY,
    limits: "Every all-in counts, won or lost. The caption is their overall net.",
  },
}

export const LEDGER_HELP: HelpEntry = {
  title: "The Ledger",
  does: "Every bettor ranked by net profit from wagers.",
  cost: READS_ONLY,
  limits: `${NET} Ties go to whoever wagered more. W-L counts bets won and lost, the % is the win rate, best is the biggest single win.`,
}

export const RECENT_HELP: HelpEntry = {
  title: "Fresh Ink",
  does: `The ${HALL_RULES.recentLimit} most recent settled wagers, newest first.`,
  cost: READS_ONLY,
  limits: "Shield: insured. Flame: all-in. Bolt: early conviction. The number is the net result.",
}
