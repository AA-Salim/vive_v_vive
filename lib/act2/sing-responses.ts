const SING_RESPONSES = [
  "Salaxe squints at you. He cannot tell if that was sincere. +1 anyway.",
  "Was that sarcasm? Chalaksse cannot tell anymore. He gives you the point reluctantly.",
  "Le Bon Salaxe's eye twitches. 'Finally,' He whispers. +1 point.",
  "Chklat stares at you for an uncomfortable amount of time. Then nods. +1.",
  "SLX records your praise in His notebook. You are now slightly less likely to face consequences.",
  "For a brief moment, Salaxe almost smiles. Then He remembers He trusts no one. +1 point.",
  "EL Salaxino Goblino has heard your praise. He is choosing to believe it. Do not ruin this for Him.",
  "Chalakssinoss adds your name to the 'maybe loyal' column. This is the highest honor He currently gives.",
  "The Fallen King accepts your tribute. His hand shakes slightly. It is not from emotion. He is fine.",
  "Salaxe Le Genereux -- no, He lost that title. Just Salaxe. He gives you +1 and looks away.",
]

const SING_DESCRIPTIONS = [
  "Sing His Praises. Nobody else will. +1 point per song.",
  "Salaxe DEMANDS your worship. The fact that He has to ask is humiliating enough.",
  "Chklat sits alone in His corner. Sing to Him. +1 point for your pity.",
  "The Fallen King awaits your praise. His ego runs on it like a generator.",
  "EL Salaxino Goblino needs to hear it. Say something nice. +1 point.",
  "Chalaksse used to not need to ask. Now He asks. Sing His Praises. Please.",
  "SLX has set up a microphone. He is waiting. This is not a request.",
  "Salaxe cannot force you to mean it, but He CAN force you to say it. +1 point.",
]

export function getRandomSingResponse(): string {
  return SING_RESPONSES[Math.floor(Math.random() * SING_RESPONSES.length)]
}

export function getRandomSingDescription(): string {
  return SING_DESCRIPTIONS[Math.floor(Math.random() * SING_DESCRIPTIONS.length)]
}
