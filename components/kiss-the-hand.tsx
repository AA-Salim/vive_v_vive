"use client"

import { HandKissers } from "@/components/hand-kissers"
import { PraisePanel } from "@/components/praise/praise-panel"

export function KissTheHand() {
  return (
    <>
      <PraisePanel />
      <HandKissers />
    </>
  )
}

export const SingHisPraises = KissTheHand
