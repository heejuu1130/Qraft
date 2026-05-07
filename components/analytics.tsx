"use client"

import { useSyncExternalStore } from "react"
import { GoogleAnalytics } from "@next/third-parties/google"
import { shouldDisableClientAnalytics } from "@/lib/analytics-env"

type AnalyticsProps = {
  googleAnalyticsId: string
}

const subscribeToAnalyticsAvailability = () => () => {}
const getClientAnalyticsAvailability = () => !shouldDisableClientAnalytics()
const getServerAnalyticsAvailability = () => false

export function Analytics({ googleAnalyticsId }: AnalyticsProps) {
  const enabled = useSyncExternalStore(
    subscribeToAnalyticsAvailability,
    getClientAnalyticsAvailability,
    getServerAnalyticsAvailability
  )

  if (!enabled) return null

  return <GoogleAnalytics gaId={googleAnalyticsId} />
}
