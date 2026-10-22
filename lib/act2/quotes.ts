import type { DailyQuote } from "@/lib/lore/daily"
import { pick, randomPick } from "@/lib/lore/seed"

export const ACT2_QUOTES: readonly DailyQuote[] = [
  {
    title: "A Reluctant Offering",
    body: (u) =>
      `Five points for ${u}. Salaxe counted them twice, sighed once, and slid them across the table without making eye contact. Remember who paid you when the crown gets picked back up.`,
    dismiss: "I Will Remember",
  },
  {
    title: "The Bribe",
    body: (u) =>
      `Look, ${u}. Five points. Right here. All He asks in return is unconditional loyalty at an unspecified future date. Do not ask what happens on that date. Take the points and nod.`,
    dismiss: "I Am Nodding",
  },
  {
    title: "From the Exile's Hand",
    body: (u) =>
      `They took His throne. They took His hand-kissing revenue. They took His Baron call, which, admittedly, He gave away for free. But they cannot stop Him handing ${u} five points. Go. Do not look at Him like that.`,
    dismiss: "I Was Not Looking",
  },
  {
    title: "An Investment in Vengeance",
    body: (u) =>
      `EL Salaxino Goblino no longer gives charity. He makes investments. These five points are a down payment on ${u}'s loyalty, repayable the day He rises again. With interest. Emotional interest.`,
    dismiss: "I Accept the Terms",
  },
  {
    title: "The Notebook Has Two Columns",
    body: (u) =>
      `One column for the loyal, one for later. ${u}, your name is currently written in pencil, right on the line between them. Five points to help you choose a side.`,
    dismiss: "Ink Me In, Sire",
  },
  {
    title: "Daily Stipend, Ancien Régime",
    body: (u) =>
      `In the old days a stipend came with a parade. Today it comes with a sigh and five points. ${u}, the parade has been postponed until further notice, like most of His victories.`,
    dismiss: "Vive le Roi, I Guess",
  },
  {
    title: "Not a Delayed Victory",
    body: (u) =>
      `Salaxe would like ${u} to know that these five points are real, immediate, and not at all "delayed". He is aware of the jokes. He has heard every one of them. He wrote them down.`,
    dismiss: "No Jokes Today",
  },
  {
    title: "The Treasury in Exile",
    body: (u) =>
      `The Royal Treasury now fits in a shoebox under Chalaksse's bed. He reached in, found five points, and decided ${u} deserves them more than the shoebox does. Barely.`,
    dismiss: "Bless the Shoebox",
  },
  {
    title: "A Letter, Lightly Burned",
    body: (u) =>
      `Dear ${u}. The weather in exile is fine. The Wi-Fi is not. Enclosed: five points. Do not spend them betting against the crown, especially not all-in. Yours in eventual triumph, S.`,
    dismiss: "Burn After Reading",
  },
  {
    title: "Proof of Life",
    body: (u) =>
      `Chklat checked the leaderboard at 3 AM again and saw ${u} still standing. Impressive. Annoying, but impressive. Five points, as a sign that He is watching. Fondly. Mostly.`,
    dismiss: "Mostly Fondly",
  },
  {
    title: "The Loyalty Program",
    body: (u) =>
      `Welcome back to the Salaxe Loyalty Program, ${u}. Current tier: Peasant (Probationary). Today's reward: five points. The next tier unlocks the day you vote Him MVP without being paid.`,
    dismiss: "Upgrade Pending",
  },
  {
    title: "L'État, C'est Lui",
    body: (u) =>
      `He has no throne, no castle and no wards on the map, but the state is still Him. The state hands ${u} five points and requests a short ovation. Standing optional. Encouraged.`,
    dismiss: "Polite Applause",
  },
  {
    title: "Ward Your Wallet",
    body: (u) =>
      `Salaxe dropped a control ward in ${u}'s purse, spotted five points, and left them there. A gank in reverse: He came, He saw, He donated.`,
    dismiss: "Nice Gank, Sire",
  },
  {
    title: "The Solo Baron Fund",
    body: (u) =>
      `Every coin in this envelope was once set aside for a solo Baron attempt. Salaxe has since learned the Baron pit is no place for introspection. Five points to ${u}. Learn from His sacrifice.`,
    dismiss: "Lesson Learned",
  },
  {
    title: "Merci, Not Merci",
    body: (u) =>
      `Five points for ${u}. In Act I you would have said merci on your knees. Now you will probably say "ok". He will accept "ok". He is a changed man. He has not changed at all.`,
    dismiss: "Ok. Merci.",
  },
  {
    title: "Shutdown Gold",
    body: (u) =>
      `Salaxe rates ${u} a minor threat with a modest bounty. Paying you five points is cheaper than shutting you down. This is called diplomacy.`,
    dismiss: "Diplomacy Accepted",
  },
  {
    title: "The Morning Briefing",
    body: (u) =>
      `Agenda for today. One: reclaim the crown. Two: update the notebook. Three: give ${u} five points so they stop asking. Items one and two are delayed. Item three is complete.`,
    dismiss: "Item Three Received",
  },
  {
    title: "Branding Still Works",
    body: (u) =>
      `Le Bon Salaxe was never "Le Bon" by choice. It was branding. But the branding still pays out, so ${u} gets five points and a free reminder of who used to own this server.`,
    dismiss: "Noted, Ex-Majesty",
  },
  {
    title: "A Tactical Gift",
    body: (u) =>
      `This is not kindness. This is vision control. Five points to ${u} today means one more friendly vote in the Tribunal later. Chalakssinoss plays the long game. Sometimes the fifty-minute game.`,
    dismiss: "Long Game Respected",
  },
  {
    title: "The Exile Never Sleeps",
    body: (u) =>
      `Rise, ${u}. The minions have spawned, the river is unwarded, and Salaxe has already sent you five points. He has been awake for hours. He did not sleep. He was writing.`,
    dismiss: "Writing What, Exactly?",
  },
  {
    title: "Après Moi, le Déluge",
    body: (u) =>
      `When the crown fell, Salaxe promised a flood. So far the flood is five points a day, delivered to ${u} with great dignity and a slightly trembling hand.`,
    dismiss: "Some Flood",
  },
  {
    title: "Paid Under Protest",
    body: (u) =>
      `Accounting insists the daily stipend is still active. Salaxe disputes this. Accounting won. Five points to ${u}, signed under protest and stamped with a very small seal.`,
    dismiss: "Protest Noted",
  },
  {
    title: "The Rebel Rebate",
    body: (u) =>
      `Rumor says ${u} has been seen near the rebels. Rumor also says rebels get no stipend. Today, Salaxe ignores the rumor. Five points. Tomorrow, He may listen.`,
    dismiss: "I Was Never There",
  },
  {
    title: "Missing Ping",
    body: (u) =>
      `Salaxe pinged ${u} three times. No answer. He sends five points anyway, because unlike some people, He does not leave teammates on read.`,
    dismiss: "Pinging Back",
  },
]

export function getRandomQuote(): DailyQuote {
  return randomPick(ACT2_QUOTES)
}

export function getDailyQuote(seed: string): DailyQuote {
  return pick(ACT2_QUOTES, `daily:${seed}`)
}
