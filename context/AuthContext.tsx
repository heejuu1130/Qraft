"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { gtag, type LoginProvider } from "@/lib/gtag"
import { mixpanelIdentify, mixpanelReset } from "@/lib/mixpanel"
import { createClient } from "@/lib/supabase/client"
import { clearStoredQuestionData } from "@/lib/client-storage"
import {
  isLocalDevAuthEnabled,
  localDevAuthStorageKey,
  localDevUserId,
} from "@/lib/local-dev-auth"

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  signInLocalDev: () => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signInLocalDev: () => {},
  signOut: async () => {},
})

const pendingLoginProviderStorageKey = "qraft:pending-login-provider"
const visitedStorageKey = "qraft:ga-visited"
const returningVisitSentStorageKey = "qraft:ga-returning-visit-sent"

type ClientStorageName = "localStorage" | "sessionStorage"

const isLoginProvider = (value: unknown): value is LoginProvider =>
  value === "google" || value === "kakao"

const warnStorageSkipped = (label: string, error: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    console.warn(label, error)
  }
}

const readStorageItem = (storageName: ClientStorageName, key: string) => {
  try {
    return window[storageName].getItem(key)
  } catch (error) {
    warnStorageSkipped(`${storageName} read skipped`, error)
    return null
  }
}

const writeStorageItem = (storageName: ClientStorageName, key: string, value: string) => {
  try {
    window[storageName].setItem(key, value)
    return true
  } catch (error) {
    warnStorageSkipped(`${storageName} write skipped`, error)
    return false
  }
}

const removeStorageItem = (storageName: ClientStorageName, key: string) => {
  try {
    window[storageName].removeItem(key)
  } catch (error) {
    warnStorageSkipped(`${storageName} remove skipped`, error)
  }
}

const getAuthProvider = (session: Session | null) => {
  const sessionProvider = session?.user.app_metadata.provider

  return isLoginProvider(sessionProvider) ? sessionProvider : undefined
}

const identifyMixpanelUser = (session: Session | null) => {
  if (!session?.user) return

  mixpanelIdentify(session.user.id, {
    signed_in: true,
    auth_provider: getAuthProvider(session),
  })
}

const trackPendingLoginSuccess = (session: Session | null) => {
  if (!session) return

  const pendingProvider = readStorageItem("localStorage", pendingLoginProviderStorageKey)
  const sessionProvider = getAuthProvider(session)
  const provider = isLoginProvider(pendingProvider)
    ? pendingProvider
    : sessionProvider ?? null

  if (!provider) return

  gtag.loginSuccess(provider)
  removeStorageItem("localStorage", pendingLoginProviderStorageKey)
}

const trackReturningVisit = () => {
  const hasVisited = readStorageItem("localStorage", visitedStorageKey) === "true"
  const alreadySent = readStorageItem("sessionStorage", returningVisitSentStorageKey) === "true"

  if (hasVisited && !alreadySent) {
    if (gtag.returningVisit()) {
      writeStorageItem("sessionStorage", returningVisitSentStorageKey, "true")
    }
  }

  writeStorageItem("localStorage", visitedStorageKey, "true")
}

const createLocalDevUser = (): User => {
  const now = new Date().toISOString()

  return {
    id: localDevUserId,
    aud: "authenticated",
    role: "authenticated",
    email: "local@qraft.dev",
    email_confirmed_at: now,
    phone: "",
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: {
      provider: "local-dev",
      providers: ["local-dev"],
    },
    user_metadata: {
      full_name: "Local Preview",
      name: "Local Preview",
    },
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  } as User
}

const createLocalDevSession = (): Session => ({
  access_token: "local-dev-access-token",
  expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
  expires_in: 60 * 60 * 24,
  refresh_token: "local-dev-refresh-token",
  token_type: "bearer",
  user: createLocalDevUser(),
} as Session)

const readLocalDevSession = () => {
  if (!isLocalDevAuthEnabled()) return null

  return readStorageItem("localStorage", localDevAuthStorageKey) === "true"
    ? createLocalDevSession()
    : null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    trackReturningVisit()

    supabase.auth.getSession().then(({ data: { session } }) => {
      const activeSession = readLocalDevSession() ?? session

      identifyMixpanelUser(activeSession)
      trackPendingLoginSuccess(activeSession)
      setSession(activeSession)
      setUser(activeSession?.user ?? null)
      setLoading(false)
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const localDevSession = event === "SIGNED_OUT" ? null : readLocalDevSession()
      const activeSession = localDevSession ?? session

      if (event === "SIGNED_IN") {
        identifyMixpanelUser(activeSession)
        trackPendingLoginSuccess(activeSession)
      }

      if (event === "SIGNED_OUT") {
        removeStorageItem("localStorage", localDevAuthStorageKey)
        clearStoredQuestionData()
        mixpanelReset()
      }

      setSession(activeSession)
      setUser(activeSession?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const signInLocalDev = () => {
    if (!isLocalDevAuthEnabled()) return

    writeStorageItem("localStorage", localDevAuthStorageKey, "true")
    const localSession = createLocalDevSession()

    identifyMixpanelUser(localSession)
    setSession(localSession)
    setUser(localSession.user)
    setLoading(false)
  }

  const signOut = async () => {
    removeStorageItem("localStorage", localDevAuthStorageKey)
    clearStoredQuestionData()
    mixpanelReset()
    setSession(null)
    setUser(null)
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signInLocalDev, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
