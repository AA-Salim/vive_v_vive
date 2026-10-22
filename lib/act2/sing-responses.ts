import { randomPick } from "@/lib/lore/seed"

const SING_RESPONSES = [
  "Salaxe squints. He cannot tell if that was sincere. He takes it anyway.",
  "Was that sarcasm? Chalaksse can no longer tell. He has decided it was not.",
  "Le Bon Salaxe's eye twitches. \"Finally,\" He whispers, to nobody.",
  "Chklat stares at you for an uncomfortable amount of time. Then nods, once.",
  "SLX writes your verse in the notebook. In the good column. For now.",
  "For one brief moment, Salaxe almost smiles. Then He remembers He trusts no one.",
  "EL Salaxino Goblino has heard your song. He is choosing to believe it. Do not ruin this for Him.",
  "Chalakssinoss moves your name to the \"maybe loyal\" column. Highest honor currently available.",
  "The fallen King accepts your tribute. His hand shakes slightly. He is fine. Everything is fine.",
  "Salaxe Le Genereux... no, He lost that title. Just Salaxe. He accepts your praise and looks away.",
  "The exile hums along. Off-key. He would like you to forget that part.",
  "Somewhere far away, a crown on the floor glows, very slightly.",
  "Salaxe saves your verse in a folder named \"Proof of Loyalty (Do Not Share)\".",
  "He asked for a second verse. He did not say please. He has never said please.",
  "Chalaksse replies with a single word: \"noted\". From Him, that is a hug.",
  "A gold star sticker appears next to your name in the notebook. He bought the stickers specially.",
  "Your praise echoes through the empty court. Excellent acoustics in there. No people, but excellent acoustics.",
  "Salaxe pretends not to care. He has listened to it eleven times.",
  "The King in exile requests a recording. For morale. His morale.",
  "SLX approves. The rebels saw that. Choose your next song carefully.",
  "A loyalist sings. Somewhere, a rebel sighs into their Kingslayer title.",
  "Chklass is moved. Not to tears. To a slightly warmer opinion of you.",
  "Your praise has been filed with the Royal Archives, the Royal Notebook and the Royal Group Chat (one member).",
  "Salaxe adjusts the crown that is not on His head. Habit.",
  "Le Bon Salaxe pins your verse above His bed, right next to the 0/8 Yone screenshot He insists is fake.",
  "The exile reads it twice, then pings \"?\" in chat. Translation: more.",
  "EL Salaxino Goblino nods slowly. Somewhere, a rebel loses a little faith in the rebellion.",
  "Chklat files your praise under \"Allies (Provisional)\". The folder is very thin.",
  "Salaxe would like it on record that He did not ask for this. He asked for exactly this.",
  "The notebook pen hovers over your name, then moves on. Today, you are spared.",
]

const SING_DESCRIPTIONS = [
  "Sing His Praises. Nobody else will. The exiled treasury pays for every verse.",
  "Salaxe demands worship. The fact that He has to ask is humiliating enough. Help Him.",
  "Chklat sits alone in His corner of the server. Sing to Him. He pays in pity.",
  "The fallen King awaits your praise. His ego recharges on it like a Teleport channel: slowly, but it gets there.",
  "EL Salaxino Goblino needs to hear it. Say something nice. Mean it a little.",
  "Chalaksse used to not need to ask. Now He asks. Sing His Praises. He did not say please.",
  "SLX has set up a microphone in exile. The red light is on. He is waiting.",
  "Salaxe cannot force you to mean it, but He can pay you to say it. That is called diplomacy.",
  "Loyalists sing. Rebels watch. The notebook records both.",
  "A verse a day keeps your name out of the wrong column.",
  "The court is empty but the acoustics are excellent. Sing for the exiled King.",
  "Every song is a vote for the return of the crown. Or at least the return of His confidence.",
  "Praise the exile. It costs nothing, pays a little, and annoys the rebels a lot.",
  "Salaxe has prepared a throne-shaped chair for listening. He is sitting in it. Waiting.",
  "The fallen King accepts compliments about His Baron calls, His drafts, and especially His hair.",
  "Say something nice about Chalaksse. Specific is better. \"Good game\" is not specific.",
  "EL Salaxino Goblino is taking requests. Only one genre is accepted: Him.",
  "The crown is on the floor. Your voice might be what lifts it. Probably not. Try anyway.",
  "Le Bon Salaxe reads every verse in the voice of a royal herald. Out loud. Alone.",
  "Rebels mock. Loyalists sing. The paid ones sing loudest.",
  "SLX promises to remember every singer when the crown returns. He keeps that list in pen.",
  "The exiled court needs a bard. The position is unpaid, except for the part that is paid.",
  "Compose an ode to the man who once called Baron alone. Courage deserves a song. Allegedly.",
  "Chklass is listening through the wall of exile. The wall is thin. Sing up.",
]

export function getRandomSingResponse(): string {
  return randomPick(SING_RESPONSES)
}

export function getRandomSingDescription(): string {
  return randomPick(SING_DESCRIPTIONS)
}
