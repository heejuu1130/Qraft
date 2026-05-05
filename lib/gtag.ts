import { mixpanelTrack } from "@/lib/mixpanel"

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

export type LoginProvider = "google" | "kakao"

const googleAnalyticsId = process.env.NEXT_PUBLIC_GA_ID || "G-T3TCC34TS8"

function warnAnalyticsSkipped(label: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(label, error)
  }
}

function getGtagArgs(entry: unknown) {
  if (Array.isArray(entry)) return entry

  if (
    entry &&
    typeof entry === "object" &&
    typeof (entry as { length?: unknown }).length === "number"
  ) {
    return Array.from(entry as ArrayLike<unknown>)
  }

  return []
}

function hasQueuedConfig(measurementId: string) {
  return window.dataLayer?.some((entry) => {
    const [command, id] = getGtagArgs(entry)

    return command === "config" && id === measurementId
  })
}

function ensureGtagQueue() {
  if (!Array.isArray(window.dataLayer)) {
    window.dataLayer = []
  }

  if (typeof window.gtag !== "function") {
    window.gtag = (...args: unknown[]) => {
      if (!Array.isArray(window.dataLayer)) {
        window.dataLayer = []
      }

      window.dataLayer.push(args)
    }
  }

  if (googleAnalyticsId && !hasQueuedConfig(googleAnalyticsId)) {
    window.gtag("js", new Date())
    window.gtag("config", googleAnalyticsId, { send_page_view: false })
  }
}

function send(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return false

  const pageParams = {
    page_location: window.location.href,
    page_path: window.location.pathname,
    page_title: document.title,
  }
  const eventParams = {
    ...pageParams,
    ...(params ?? {}),
  }

  try {
    mixpanelTrack(name, eventParams)
  } catch (error) {
    warnAnalyticsSkipped("Mixpanel tracking skipped", error)
  }

  try {
    ensureGtagQueue()
    window.gtag?.("event", name, {
      ...(googleAnalyticsId ? { send_to: googleAnalyticsId } : {}),
      ...eventParams,
    })
    return true
  } catch (error) {
    warnAnalyticsSkipped("Google Analytics tracking skipped", error)
    return false
  }
}

export const gtag = {
  questionGenerateRequest: (params?: Record<string, unknown>) =>
    send("question_generate_request", params),
  questionGenerateSuccess: (params?: Record<string, unknown>) =>
    send("question_generate_success", params),
  questionGenerateFailure: (params?: Record<string, unknown>) =>
    send("question_generate_failure", params),
  questionRegenerateRequest: () => send("question_regenerate_request"),
  questionRegenerateSuccess: (params?: Record<string, unknown>) =>
    send("question_regenerate_success", params),
  questionRegenerateFailure: () => send("question_regenerate_failure"),
  tokenExhausted: (params?: Record<string, unknown>) => send("token_exhausted", params),
  questionInputFocus: (params?: Record<string, unknown>) => send("question_input_focus", params),
  landingCtaClick: () => send("landing_cta_click"),
  landingSectionView: (params?: Record<string, unknown>) => send("landing_section_view", params),
  exampleTopicSelect: (params?: Record<string, unknown>) => send("example_topic_select", params),
  loginStart: (provider: LoginProvider) => {
    send("login_start", { method: provider })
    if (typeof window === "undefined") return

    try {
      window.localStorage.setItem("qraft:pending-login-provider", provider)
    } catch (error) {
      warnAnalyticsSkipped("Pending login provider storage skipped", error)
    }
  },
  loginSuccess: (provider: LoginProvider) => {
    send("login", { method: provider })
    send("login_success", { method: provider })
  },
  loginPromptView: (params?: Record<string, unknown>) => send("login_prompt_view", params),
  questionSaveIntent: (params?: Record<string, unknown>) => send("question_save_intent", params),
  questionSave: (params?: Record<string, unknown>) => send("question_save", params),
  questionUnsave: (params?: Record<string, unknown>) => send("question_unsave", params),
  landingVisit: () => send("landing_visit", { landing_path: window.location.pathname, value: 1 }),
  resultSummaryToggle: (params?: Record<string, unknown>) => send("result_summary_toggle", params),
  resultReflectionToggle: (params?: Record<string, unknown>) => send("result_reflection_toggle", params),
  feedbackOpen: (params?: Record<string, unknown>) => send("feedback_open", params),
  feedbackRatingSelect: (params?: Record<string, unknown>) => send("feedback_rating_select", params),
  feedbackSubmitSuccess: (params?: Record<string, unknown>) => send("feedback_submit_success", params),
  feedbackSubmitFailure: (params?: Record<string, unknown>) => send("feedback_submit_failure", params),
  bgmToggle: (params?: Record<string, unknown>) => send("bgm_toggle", params),
  profileTabSelect: (params?: Record<string, unknown>) => send("profile_tab_select", params),
  profileHistoryToggle: (params?: Record<string, unknown>) => send("profile_history_toggle", params),
  profileHistoryView: () => send("profile_history_view"),
  returningVisit: () => send("returning_visit"),
}
