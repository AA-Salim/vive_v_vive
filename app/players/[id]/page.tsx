import type { Metadata } from "next"
import { PlayerProfilePage } from "@/components/profile/profile-page"
import { ScopeParam } from "@/lib/profiles/types"

export const metadata: Metadata = {
  title: "Court File | Vive v Vive Custom",
}

function decoded(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export default async function PlayerPage(props: PageProps<"/players/[id]">) {
  const [{ id }, search] = await Promise.all([props.params, props.searchParams])
  const act = ScopeParam.safeParse(typeof search.act === "string" ? search.act : undefined)
  return <PlayerProfilePage key={id} player={decoded(id)} initialScope={act.success ? act.data : "current"} />
}
