import type { Metadata, Viewport } from "next"
import { Cinzel, Geist, Geist_Mono } from "next/font/google"
import { Toaster } from "@/components/ui/sonner"
import { Nav } from "@/components/nav"
import { SalaxeBroadcast } from "@/components/salaxe-broadcast"
import { ActIntroModal } from "@/components/act-intro-modal"
import { Providers } from "@/components/providers"
import { BRAND } from "@/lib/brand"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: BRAND.name,
  description: BRAND.description,
  applicationName: BRAND.shortName,
  appleWebApp: {
    capable: true,
    title: BRAND.shortName,
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark",
  themeColor: BRAND.colors.navy,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${cinzel.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <a
            href="#main"
            className="sr-only z-[60] rounded-lg bg-[var(--color-gold)] px-4 py-2 text-sm font-semibold text-[var(--color-navy)] focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
          >
            Skip to content
          </a>
          <Nav />
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto w-full max-w-[1400px] flex-1 overflow-x-clip px-4 pt-5 pb-[calc(var(--app-tabbar-height)+env(safe-area-inset-bottom,0px)+1.5rem)] outline-none sm:px-6 sm:pt-6 lg:pb-14"
          >
            {children}
          </main>
          <SalaxeBroadcast />
          <ActIntroModal />
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
