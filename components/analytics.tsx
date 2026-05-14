"use client"

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react"
import { GoogleAnalytics } from "@next/third-parties/google"
import { usePathname } from "next/navigation"
import { shouldDisableClientAnalytics } from "@/lib/analytics-env"
import { gtag } from "@/lib/gtag"

type AnalyticsProps = {
  googleAnalyticsId: string
}

const subscribeToAnalyticsAvailability = () => () => {}
const getClientAnalyticsAvailability = () => !shouldDisableClientAnalytics()
const getServerAnalyticsAvailability = () => false

type PageViewSession = {
  startedAt: number
  path: string
  title: string
}

export function Analytics({ googleAnalyticsId }: AnalyticsProps) {
  const pathname = usePathname()
  const pageViewSessionRef = useRef<PageViewSession | null>(null)
  const enabled = useSyncExternalStore(
    subscribeToAnalyticsAvailability,
    getClientAnalyticsAvailability,
    getServerAnalyticsAvailability
  )

  const startPageViewSession = useCallback((path: string) => {
    if (pageViewSessionRef.current || document.visibilityState !== "visible") return

    pageViewSessionRef.current = {
      startedAt: window.performance.now(),
      path,
      title: document.title,
    }
  }, [])

  const flushPageViewSession = useCallback((exitReason: string) => {
    const session = pageViewSessionRef.current
    if (!session) return

    pageViewSessionRef.current = null
    const durationMs = Math.max(0, Math.round(window.performance.now() - session.startedAt))

    gtag.pageViewDuration({
      duration_ms: durationMs,
      duration_seconds: Number((durationMs / 1000).toFixed(2)),
      exit_reason: exitReason,
      tracked_page_path: session.path,
      tracked_page_title: session.title,
      transport_type: "beacon",
    })
  }, [])

  useEffect(() => {
    if (!enabled) return

    startPageViewSession(pathname)

    return () => {
      flushPageViewSession("route_change")
    }
  }, [enabled, flushPageViewSession, pathname, startPageViewSession])

  useEffect(() => {
    if (!enabled) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startPageViewSession(pathname)
        return
      }

      flushPageViewSession("page_hidden")
    }
    const handlePageHide = () => flushPageViewSession("pagehide")

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("pagehide", handlePageHide)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("pagehide", handlePageHide)
      flushPageViewSession("component_unmount")
    }
  }, [enabled, flushPageViewSession, pathname, startPageViewSession])

  if (!enabled) return null

  return <GoogleAnalytics gaId={googleAnalyticsId} />
}
