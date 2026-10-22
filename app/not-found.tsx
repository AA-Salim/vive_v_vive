import Link from "next/link"
import { CrownIcon, SwordsIcon } from "lucide-react"
import { StatusScreen } from "@/components/status-screen"
import { buttonVariants } from "@/components/ui/button"

export default function NotFound() {
  return (
    <StatusScreen
      eyebrow="404 · Lost in the fog of war"
      title="This lane does not exist"
      footnote="If a link sent you here, the link is the one who inted."
      actions={
        <>
          <Link href="/" className={buttonVariants({ variant: "royal", size: "lg" })}>
            <SwordsIcon />
            Back to the match room
          </Link>
          <Link href="/leaderboard" className={buttonVariants({ variant: "outline", size: "lg" })}>
            <CrownIcon />
            See who rules the court
          </Link>
        </>
      }
    >
      You wandered off the map. Not even Salaxe&apos;s solo Baron call strayed this far, and that one lasted 0.3 seconds.
    </StatusScreen>
  )
}
