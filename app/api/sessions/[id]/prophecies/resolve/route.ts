import { NextResponse } from "next/server"

// Prophecies settle themselves through the post-game vote; manual resolution (and its bonus payout) is gone.
export async function POST() {
  return NextResponse.json(
    {
      error: "Prophecies are now settled by the post-game vote. There is nothing left to resolve by hand.",
      code: "prophecy_resolution_retired",
    },
    { status: 410 }
  )
}
