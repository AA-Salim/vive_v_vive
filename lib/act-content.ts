import {
  getRandomBroadcast as act1Broadcast,
} from "@/lib/salaxe-broadcasts"
import {
  getRandomBroadcast as act2Broadcast,
  BROADCAST_LABEL as act2BroadcastLabel,
} from "@/lib/act2/broadcasts"

import {
  getRandomQuote as act1Quote,
} from "@/lib/salaxe-quotes"
import {
  getRandomQuote as act2Quote,
} from "@/lib/act2/quotes"

import {
  getRandomKissResponse as act1KissResponse,
  getRandomKissDescription as act1KissDescription,
} from "@/lib/salaxe-kiss-responses"
import {
  getRandomSingResponse as act2SingResponse,
  getRandomSingDescription as act2SingDescription,
} from "@/lib/act2/sing-responses"

import { getRandomPhrase as act1Phrase } from "@/lib/slaxe-phrases"
import { getRandomPhrase as act2Phrase } from "@/lib/act2/phrases"

export function getActContent(actNumber: number) {
  switch (actNumber) {
    case 2:
    default:
      return {
        getRandomBroadcast: act2Broadcast,
        broadcastLabel: act2BroadcastLabel,
        getRandomQuote: act2Quote,
        getRandomPraiseResponse: act2SingResponse,
        getRandomPraiseDescription: act2SingDescription,
        getRandomPhrase: act2Phrase,
        praiseTitle: "Sing His Praises",
        praiseAction: "Sing",
        praiseSinging: "Singing...",
        praiseExhausted: "You have sung enough for today.",
        praiseExhaustedButton: "Voice Tired",
        praiseReason: "sing_his_praises" as const,
      }
    case 1:
      return {
        getRandomBroadcast: act1Broadcast,
        broadcastLabel: "ROYAL BROADCAST",
        getRandomQuote: act1Quote,
        getRandomPraiseResponse: act1KissResponse,
        getRandomPraiseDescription: act1KissDescription,
        getRandomPhrase: act1Phrase,
        praiseTitle: "Kiss the Royal Hand",
        praiseAction: "Kiss the Hand",
        praiseSinging: "Kissing...",
        praiseExhausted: "You have shown sufficient devotion for today.",
        praiseExhaustedButton: "Hand Weary",
        praiseReason: "kiss_the_hand" as const,
      }
  }
}
