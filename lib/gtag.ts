import { mixpanelTrack } from "@/lib/mixpanel"

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export type LoginProvider = "google" | "kakao"

function send(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return

  try {
    mixpanelTrack(name, params)
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Mixpanel tracking skipped", error)
    }
  }

  if (typeof window.gtag === "function") {
    window.gtag("event", name, params)
    return
  }

  window.dataLayer = window.dataLayer ?? []
  window.dataLayer.push(["event", name, params])
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
    window.localStorage.setItem("qraft:pending-login-provider", provider)
  },
  loginSuccess: (provider: LoginProvider) => {
    send("login", { method: provider })
    send("login_success", { method: provider })
  },
  loginPromptView: (params?: Record<string, unknown>) => send("login_prompt_view", params),
  questionSaveIntent: (params?: Record<string, unknown>) => send("question_save_intent", params),
  questionSave: (params?: Record<string, unknown>) => send("question_save", params),
  questionUnsave: (params?: Record<string, unknown>) => send("question_unsave", params),
  landingVisit: () => send("landing_visit"),
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
