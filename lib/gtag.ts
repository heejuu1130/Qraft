declare global {
  interface Window {
    gtag: (...args: unknown[]) => void
  }
}

function send(name: string, params?: Record<string, unknown>) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", name, params)
  }
}

export const gtag = {
  generateQuestions: () => send("generate_questions"),
  regenerateQuestions: () => send("regenerate_questions"),
  login: (provider: "google" | "kakao") => send("login", { method: provider }),
  saveQuestion: () => send("save_question"),
  removeSavedQuestion: () => send("remove_saved_question"),
  viewProfileHistory: () => send("view_profile_history"),
}
