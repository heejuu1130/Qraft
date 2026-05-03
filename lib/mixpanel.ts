import mixpanel from "mixpanel-browser"

type MixpanelProperties = Record<string, unknown>

const mixpanelToken = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN?.trim()
let initialized = false

function cleanProperties(properties?: MixpanelProperties) {
  if (!properties) return undefined

  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  )
}

function initMixpanel() {
  if (initialized) return true
  if (typeof window === "undefined" || !mixpanelToken) return false

  mixpanel.init(mixpanelToken, {
    debug: process.env.NODE_ENV !== "production",
    persistence: "localStorage",
    track_pageview: false,
  })

  mixpanel.register({
    app: "qraft",
    environment: process.env.NODE_ENV,
  })

  mixpanel.register_once({
    first_landing_path: window.location.pathname,
    ...(document.referrer ? { first_referrer: document.referrer } : {}),
  })

  initialized = true
  return true
}

export function mixpanelTrack(name: string, properties?: MixpanelProperties) {
  if (!initMixpanel()) return

  mixpanel.track(name, cleanProperties(properties) ?? {})
}

export function mixpanelIdentify(userId: string, properties?: MixpanelProperties) {
  if (!initMixpanel()) return

  mixpanel.identify(userId)

  const cleanedProperties = cleanProperties(properties)
  if (cleanedProperties && Object.keys(cleanedProperties).length > 0) {
    mixpanel.people.set(cleanedProperties)
  }
}

export function mixpanelReset() {
  if (!initMixpanel()) return

  mixpanel.reset()
}
