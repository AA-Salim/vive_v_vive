import {
  ACT1_BROADCASTS,
  getRandomBroadcast as act1Broadcast,
} from "@/lib/salaxe-broadcasts"
import {
  ACT2_BROADCASTS,
  getRandomBroadcast as act2Broadcast,
  BROADCAST_LABEL as act2BroadcastLabel,
} from "@/lib/act2/broadcasts"

import {
  getDailyQuote as act1DailyQuote,
  getRandomQuote as act1Quote,
} from "@/lib/salaxe-quotes"
import {
  getDailyQuote as act2DailyQuote,
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
        broadcasts: ACT2_BROADCASTS,
        broadcastLabel: act2BroadcastLabel,
        broadcastSignature: "From exile, with a grudge",
        getRandomQuote: act2Quote,
        getDailyQuote: act2DailyQuote,
        dailyKicker: "Daily stipend from exile",
        getRandomPraiseResponse: act2SingResponse,
        getRandomPraiseDescription: act2SingDescription,
        getRandomPhrase: act2Phrase,
        praiseTitle: "Sing His Praises",
        praiseAction: "Sing",
        praiseSinging: "Singing...",
        praiseExhausted: "You have sung enough for today. Salaxe is replaying the recordings.",
        praiseExhaustedButton: "Voice Spent",
        praiseReason: "sing_his_praises" as const,
      }
    case 1:
      return {
        getRandomBroadcast: act1Broadcast,
        broadcasts: ACT1_BROADCASTS,
        broadcastLabel: "ROYAL BROADCAST",
        broadcastSignature: "By order of the Crown",
        getRandomQuote: act1Quote,
        getDailyQuote: act1DailyQuote,
        dailyKicker: "The King's daily alms",
        getRandomPraiseResponse: act1KissResponse,
        getRandomPraiseDescription: act1KissDescription,
        getRandomPhrase: act1Phrase,
        praiseTitle: "Kiss the Royal Hand",
        praiseAction: "Kiss the Hand",
        praiseSinging: "Kissing...",
        praiseExhausted: "The royal hand needs its rest. Return tomorrow, lips ready.",
        praiseExhaustedButton: "Hand Weary",
        praiseReason: "kiss_the_hand" as const,
      }
  }
}
