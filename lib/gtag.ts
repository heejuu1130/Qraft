declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export type LoginProvider = "google" | "kakao"

function send(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined") return

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
  loginStart: (provider: LoginProvider) => {
    send("login_start", { method: provider })
    if (typeof window === "undefined") return
    window.localStorage.setItem("qraft:pending-login-provider", provider)
  },
  loginSuccess: (provider: LoginProvider) => {
    send("login", { method: provider })
    send("login_success", { method: provider })
  },
  questionSaveIntent: (params?: Record<string, unknown>) => send("question_save_intent", params),
  questionSave: (params?: Record<string, unknown>) => send("question_save", params),
  questionUnsave: (params?: Record<string, unknown>) => send("question_unsave", params),
  profileHistoryView: () => send("profile_history_view"),
  returningVisit: () => send("returning_visit"),
}
