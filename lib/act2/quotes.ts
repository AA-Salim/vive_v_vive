const QUOTES: Array<{
  title: string
  body: (username: string) => string
  dismiss: string
}> = [
  {
    title: "A RELUCTANT OFFERING",
    body: (u) =>
      `Salaxe has scraped together +5 points for ${u}. This is not generosity. This is strategy. You WILL remember who gave you these when the reckoning comes.`,
    dismiss: "I Will... Remember?",
  },
  {
    title: "THE BRIBE",
    body: (u) =>
      `Look, ${u}. +5 points. Right here. All He asks is undying loyalty when the time comes. You do not need to know what "the time" refers to. Just take the points and nod.`,
    dismiss: "I Am Nodding",
  },
  {
    title: "CHALAKSSE PROVIDES (BEGRUDGINGLY)",
    body: (u) =>
      `There was a time when ${u} would have WEPT to receive these. Now you probably think it is "mid." He gives them anyway. Because He is better than all of you. ESPECIALLY when you do not deserve it.`,
    dismiss: "It Is Not Mid, Sire",
  },
  {
    title: "THE LOYALTY TEST",
    body: (u) =>
      `Chklat has been watching. He has noticed who Sings His Praises and who has been suspiciously silent. These +5 points are for ${u}. Whether they keep coming depends on your behavior going forward.`,
    dismiss: "I Choose... Wisely",
  },
  {
    title: "FROM THE EXILE'S HAND",
    body: (u) =>
      `They took His throne. They took His dignity. They took His Royal Broadcast slot and reduced it to a "notification." But they cannot take His ability to give ${u} +5 points. This is all He has left. Take them. Go. Do not look at Him like that.`,
    dismiss: "I Am Not Looking At You Like That",
  },
  {
    title: "AN INVESTMENT IN VENGEANCE",
    body: (u) =>
      `EL Salaxino Goblino does not give charity anymore. He makes investments. These +5 points for ${u} are a down payment. When Salaxe rises again -- and He WILL rise again -- He expects a return. With interest. Emotional interest.`,
    dismiss: "I Accept These Terms",
  },
]

export function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)]
}
