const QUOTES: Array<{
  title: string
  body: (username: string) => string
  dismiss: string
}> = [
  {
    title: "A ROYAL DECREE",
    body: (u) =>
      `Le Bon Salaxe, in His infinite mercy, has gazed upon ${u} and deemed them barely worthy of His generosity. Bow before His magnificence.`,
    dismiss: "I Am Not Worthy",
  },
  {
    title: "THE BENEVOLENT SALAXE HAS SPOKEN",
    body: (u) =>
      `The Great Chalaksse, First of His Name, Breaker of Lanes, Destroyer of Egos, has taken pity upon the peasant known as ${u}. Be grateful. You have been bestowed +5 points by royal decree.`,
    dismiss: "Thank You, My Lord",
  },
  {
    title: "BY DIVINE WILL",
    body: (u) =>
      `Chklass the Magnificent finds ${u} utterly unremarkable, yet His boundless compassion compels Him to spare +5 points. Do not squander this gift, worm.`,
    dismiss: "I Shall Not Waste It",
  },
  {
    title: "THE SALAXE PROVIDES",
    body: (u) =>
      `By the divine will of Chklat, Supreme Ruler of the Rift, ${u} receives +5 points. Kneel. The Salaxe does not repeat His generosity twice... well, He does, daily, because He is THAT generous.`,
    dismiss: "All Hail Chklat",
  },
  {
    title: "LE GRAND SALAXE DESCENDS",
    body: (u) =>
      `Salaxe — Le Grand, Le Bon, Le Magnifique — has once again blessed the undeserving masses. ${u}, you receive +5 points. You may now weep with gratitude.`,
    dismiss: "I Weep With Joy",
  },
  {
    title: "A MERCIFUL ACT",
    body: (u) =>
      `The Salaxe, in a rare moment of mercy that shall echo through the ages, has decided that ${u} deserves to exist for another day. Here, take these +5 points and remember who feeds you.`,
    dismiss: "You Feed Me, My King",
  },
  {
    title: "CHALAKSSE REMEMBERS",
    body: (u) =>
      `While lesser mortals sleep, Le Bon Salaxe watches over His subjects. ${u}, He has noticed your pathetic devotion and rewards it with +5 points. You are welcome. No, He does not accept thank-you cards. His greatness is its own reward.`,
    dismiss: "I Am Eternally Devoted",
  },
  {
    title: "THE ROYAL TREASURY OPENS",
    body: (u) =>
      `Chklass the Bountiful, Whose Generosity Knows No Bounds (But Whose Patience Does), has opened the royal treasury for ${u}. +5 points fall from His golden hands like crumbs from a king's table. Scramble for them.`,
    dismiss: "I Scramble Gratefully",
  },
  {
    title: "SALAXE LOOKS DOWN UPON YOU",
    body: (u) =>
      `From His throne of unmatched skill and beauty, Le Grand Salaxe peers down at ${u} and sighs. "They try so hard," He muses. +5 points, out of sheer pity.`,
    dismiss: "I Try My Best, Sire",
  },
  {
    title: "A BLESSING FROM ABOVE",
    body: (u) =>
      `The chronicles shall record this day: Chalaksse the Eternal, He Who Carries Every Game, has bestowed upon ${u} a sum of +5 points. Historians will weep at His benevolence. You should too.`,
    dismiss: "The Historians Are Right",
  },
  {
    title: "CHKLAT DECREES",
    body: (u) =>
      `Let it be known across all lanes and all elos: Chklat, the One True King of the Rift, has graciously allowed ${u} to receive +5 points. This act of charity physically pains Him, for every point given is a point He could have kept for Himself. And yet, He gives. Because He is Chklat.`,
    dismiss: "Because He Is Chklat",
  },
  {
    title: "THE DAILY OFFERING",
    body: (u) =>
      `Each sunrise, Le Bon Salaxe awakens and asks Himself: "Shall I bless ${u} today?" The answer is always yes. Not because they deserve it — they absolutely do not — but because Salaxe's generosity is as vast as His talent. +5 points.`,
    dismiss: "His Talent Is Vast Indeed",
  },
  {
    title: "KNEEL BEFORE CHALAKSSE",
    body: (u) =>
      `${u}. Yes, you. Chalaksse has deigned to acknowledge your existence. That alone should be reward enough, but because His heart is as large as His champion pool, He grants you +5 points. Now leave His sight before He changes His mind.`,
    dismiss: "I Leave His Sight",
  },
  {
    title: "THE SALAXE TAX REFUND",
    body: (u) =>
      `In an act of fiscal magnanimity that would make kings weep, Le Grand Salaxe has decided to redistribute +5 points to ${u}. This is not socialism. This is Salaxe-ism. You take what He gives and you say thank you.`,
    dismiss: "Thank You, My Liege",
  },
]

export function getRandomQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)]
}
