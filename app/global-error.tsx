"use client"

import { Cinzel, Geist } from "next/font/google"
import { RotateCcwIcon, SwordsIcon } from "lucide-react"
import { StatusScreen } from "@/components/status-screen"
import { Button } from "@/components/ui/button"
import "./globals.css"

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] })
const cinzel = Cinzel({ variable: "--font-cinzel", subsets: ["latin"] })

export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${cinzel.variable} dark antialiased`}>
      <body className="flex min-h-dvh flex-col">
        <title>The Rift crashed · Vive v Vive</title>
        <main className="mx-auto flex w-full max-w-[1400px] flex-1 items-center px-4 sm:px-6">
          <StatusScreen
            tone="danger"
            eyebrow="The whole court went dark"
            title="Even the throne room crashed"
            actions={
              <>
                <Button variant="royal" size="lg" onClick={() => retry()}>
                  <RotateCcwIcon />
                  Try again
                </Button>
                <Button variant="outline" size="lg" onClick={() => window.location.assign(window.location.origin)}>
                  <SwordsIcon />
                  Reload the match room
                </Button>
              </>
            }
          >
            Something failed before the page could stand up. Your points are safe on the server. Give it a second try; if the lights stay off, ping an admin on Discord.
          </StatusScreen>
        </main>
      </body>
    </html>
  )
}
