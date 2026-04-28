"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { createClient } from "@/lib/supabase-client"
import type { User } from "@supabase/supabase-js"
import type { UserProfile } from "@/lib/types"

interface AuthState {
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
  })
  const supabaseRef = useRef(createClient())

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/profile")
      const profile = await res.json()
      return profile
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    const supabase = supabaseRef.current

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const profile = await fetchProfile()
        setState({ user, profile, isLoading: false })
      } else {
        setState({ user: null, profile: null, isLoading: false })
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await fetchProfile()
        setState({ user: session.user, profile, isLoading: false })
      } else {
        setState({ user: null, profile: null, isLoading: false })
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signIn = useCallback(async () => {
    const supabase = supabaseRef.current
    await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }, [])

  const signOut = useCallback(async () => {
    const supabase = supabaseRef.current
    await supabase.auth.signOut()
    setState({ user: null, profile: null, isLoading: false })
  }, [])

  const refetchProfile = useCallback(async () => {
    const profile = await fetchProfile()
    setState((prev) => ({ ...prev, profile }))
  }, [fetchProfile])

  return {
    user: state.user,
    profile: state.profile,
    isLoading: state.isLoading,
    signIn,
    signOut,
    refetchProfile,
  }
}
