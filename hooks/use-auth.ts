"use client"

import { useCallback, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase-client"
import { forgetPushDevice } from "@/components/live/notifier"
import { PROFILE_ROOT } from "@/lib/live/events"
import type { UserProfile } from "@/lib/types"

export interface ProfileWithPlayer extends UserProfile {
  players?: { id: string; name: string; is_admin: boolean } | null
}

export const AUTH_USER_KEY = [PROFILE_ROOT, "auth-user"] as const

export function profileKey(userId: string | null | undefined) {
  return [PROFILE_ROOT, userId ?? "anonymous"] as const
}

async function readAuthUser(): Promise<User | null> {
  const { data } = await createClient().auth.getSession()
  return data.session?.user ?? null
}

async function fetchProfile(signal: AbortSignal): Promise<ProfileWithPlayer | null> {
  const res = await fetch("/api/auth/profile", { signal, cache: "no-store" })
  if (!res.ok) throw new Error(`GET /api/auth/profile failed with ${res.status}`)
  return (await res.json()) as ProfileWithPlayer | null
}

// The single Supabase auth listener for the app; mounted once by <Providers>.
export function useAuthSync() {
  const queryClient = useQueryClient()
  useEffect(() => {
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null
      const previous = queryClient.getQueryData<User | null>(AUTH_USER_KEY)
      queryClient.setQueryData(AUTH_USER_KEY, user)
      const switched = previous !== undefined && (previous?.id ?? null) !== (user?.id ?? null)
      if (switched && previous) {
        queryClient.removeQueries({ queryKey: profileKey(previous.id) })
        queryClient.removeQueries({ queryKey: ["points", previous.id] })
      }
      if (event === "USER_UPDATED" && user) {
        queryClient.invalidateQueries({ queryKey: profileKey(user.id) })
      }
    })
    return () => subscription.unsubscribe()
  }, [queryClient])
}

export function useAuthUser() {
  const query = useQuery({
    queryKey: AUTH_USER_KEY,
    queryFn: readAuthUser,
    staleTime: Infinity,
    gcTime: Infinity,
  })
  return { user: query.data ?? null, isLoading: query.isPending }
}

export function useAuth() {
  const queryClient = useQueryClient()
  const { user, isLoading: userLoading } = useAuthUser()
  const userId = user?.id ?? null

  const profileQuery = useQuery({
    queryKey: profileKey(userId),
    queryFn: ({ signal }) => fetchProfile(signal),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  })

  const signIn = useCallback(async () => {
    await createClient().auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }, [])

  const signOut = useCallback(async () => {
    await forgetPushDevice()
    await createClient().auth.signOut()
    queryClient.setQueryData(AUTH_USER_KEY, null)
    if (userId) {
      queryClient.removeQueries({ queryKey: profileKey(userId) })
      queryClient.removeQueries({ queryKey: ["points", userId] })
    }
  }, [queryClient, userId])

  const refetchProfile = useCallback(async () => {
    if (!userId) return
    await queryClient.refetchQueries({ queryKey: profileKey(userId) })
  }, [queryClient, userId])

  const profile = userId ? (profileQuery.data ?? null) : null

  return {
    user,
    profile,
    isAdmin: !!profile?.players?.is_admin,
    isLoading: userLoading || (!!userId && profileQuery.isPending),
    signIn,
    signOut,
    refetchProfile,
  }
}
