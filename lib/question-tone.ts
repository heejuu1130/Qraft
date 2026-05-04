export function normalizeQuestionEndingTone(value: string) {
  return value
    .trim()
    .replace(/무엇인가(?:요)?[?？]$/u, "무엇일까요?")
    .replace(/누구인가(?:요)?[?？]$/u, "누구일까요?")
    .replace(/어디인가(?:요)?[?？]$/u, "어디일까요?")
    .replace(/언제인가(?:요)?[?？]$/u, "언제일까요?")
    .replace(/왜인가(?:요)?[?？]$/u, "왜일까요?")
    .replace(/있는가(?:요)?[?？]$/u, "있을까요?")
    .replace(/없는가(?:요)?[?？]$/u, "없을까요?")
    .replace(/되는가(?:요)?[?？]$/u, "될까요?")
    .replace(/가능한가(?:요)?[?？]$/u, "가능할까요?")
    .replace(/타당한가(?:요)?[?？]$/u, "타당할까요?")
    .replace(/중요한가(?:요)?[?？]$/u, "중요할까요?")
    .replace(/어떤가(?:요)?[?？]$/u, "어떨까요?")
    .replace(/인가(?:요)?[?？]$/u, "일까요?")
    .replace(/한가(?:요)?[?？]$/u, "할까요?")
    .replace(/(.*[^니])까[?？]$/u, "$1까요?")
}

export function normalizeQuestionListTone(questions: unknown[]) {
  return questions
    .filter((question): question is string => typeof question === "string")
    .map(normalizeQuestionEndingTone)
    .filter(Boolean)
}
