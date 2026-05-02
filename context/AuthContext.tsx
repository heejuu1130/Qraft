"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { gtag, type LoginProvider } from "@/lib/gtag"
import { createClient } from "@/lib/supabase/client"

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
})

const pendingLoginProviderStorageKey = "qraft:pending-login-provider"
const visitedStorageKey = "qraft:ga-visited"
const returningVisitSentStorageKey = "qraft:ga-returning-visit-sent"

const isLoginProvider = (value: unknown): value is LoginProvider =>
  value === "google" || value === "kakao"

const trackPendingLoginSuccess = (session: Session | null) => {
  if (!session) return

  const pendingProvider = window.localStorage.getItem(pendingLoginProviderStorageKey)
  const sessionProvider = session.user.app_metadata.provider
  const provider = isLoginProvider(pendingProvider)
    ? pendingProvider
    : isLoginProvider(sessionProvider)
      ? sessionProvider
      : null

  if (!provider) return

  gtag.loginSuccess(provider)
  window.localStorage.removeItem(pendingLoginProviderStorageKey)
}

const trackReturningVisit = () => {
  const hasVisited = window.localStorage.getItem(visitedStorageKey) === "true"
  const alreadySent = window.sessionStorage.getItem(returningVisitSentStorageKey) === "true"

  if (hasVisited && !alreadySent) {
    gtag.returningVisit()
    window.sessionStorage.setItem(returningVisitSentStorageKey, "true")
  }

  window.localStorage.setItem(visitedStorageKey, "true")
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    trackReturningVisit()

    supabase.auth.getSession().then(({ data: { session } }) => {
      trackPendingLoginSuccess(session)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN") {
        trackPendingLoginSuccess(session)
      }

      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
