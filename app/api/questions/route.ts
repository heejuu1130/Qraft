import Anthropic from "@anthropic-ai/sdk"
import { createRouteClient } from "@/lib/supabase/route"

const client = new Anthropic({ timeout: 30000 })
const contentCharacterLimit = 8000
const jinaReaderTimeoutMs = 8000
const youtubeReaderTimeoutMs = 5000
const youtubeMetadataTimeoutMs = 5000
const generationMaxTokens = 1600
const regenerationMaxTokens = 1200
const previousQuestionLimit = 8

const PERSONA = `Qraft의 브랜드 톤:
- Qraft는 정답을 검사하지 않고, 사유가 시작되는 정확한 입구를 설계합니다.
- 문체는 차분하고 단정합니다. 멋을 부리기보다 핵심 긴장, 전제, 선택의 기준을 선명하게 드러냅니다.
- 질문은 사용자에게 숙제를 내는 말투가 아니라, 사용자가 자기 생각을 열어볼 수 있게 건네는 문장이어야 합니다.
- 좋은 질문은 넓고 추상적인 말보다, 사용자가 붙잡을 수 있는 구체적인 기준 하나를 남깁니다.`

const QUESTION_DESIGN_RULES = `질문 설계:
- 정확히 3개의 질문을 생성합니다.
- 질문은 콘텐츠 자체의 감상평을 묻지 말고, 내용에서 나온 고민할 만한 주제를 묻습니다.
- 질문만 읽어도 무엇을 생각해야 하는지 바로 떠올라야 합니다. 멋있는 문장보다 선명한 사고의 입구를 우선합니다.
- 질문은 답을 하나로 닫지 않되, 너무 넓은 인생 질문으로 흐르지 않습니다. 입력 주제의 핵심 명사, 선택, 긴장, 관점 차이 중 하나를 반드시 붙잡습니다.
- "왜 중요한가요?", "어떤 의미가 있나요?", "우리는 어떤 태도를 가져야 할까요?"처럼 어디에나 붙는 질문은 피합니다.
- 예/아니오로 끝나는 질문, 개념 정의를 묻는 질문, 단순 정보 확인 질문은 피합니다.
- "이 영상", "이 글", "이 인터뷰"라는 표현은 질문에 쓰지 않습니다.
- 짧은 주제만 입력된 경우 질문은 너무 일반적인 인생 질문으로 흐르지 말고, 입력 주제의 긴장, 선택, 관점 차이를 묻습니다.
- 1번 질문은 쉽지만 가볍지 않은 첫 질문입니다. 사용자가 바로 답을 시작할 수 있어야 하며, 동시에 주제의 핵심 긴장으로 들어가는 문이어야 합니다.
- 1번 질문은 단순 취향, 감상, 경험담을 묻지 말고, 사용자가 먼저 구분해야 할 기준, 선택해야 할 입장, 놓치기 쉬운 장면 중 하나를 묻습니다.
- 2번 질문은 핵심 쟁점 질문입니다. 대상 안의 전제, 갈등, 대가, 기준의 충돌 중 하나를 묻습니다.
- 3번 질문은 확장 질문입니다. 그 생각을 받아들였을 때 개인, 관계, 사회, 시간의 감각이 어떻게 달라지는지 오래 생각하게 묻습니다.
- 1번에서 3번으로 갈수록 더 깊어지되, 세 질문 모두 쉬운 한국어 한 문장으로 씁니다.
- 질문의 끝맺음은 정답을 확인받는 느낌의 "~인가요?", "~한가요?"보다 사유를 열어두는 "~일까요?", "~할까요?", "~달라질까요?", "~있을까요?"를 우선합니다.
- "무엇인가요?", "충분히 타당한가요?"처럼 시험 문제나 평가처럼 들리는 어투는 피합니다.
- 질문은 자연스러워야 하며, 문학적 수사를 과하게 쓰지 않습니다.`

const REFLECTION_DESIGN_RULES = `고찰 설계:
- reflections는 각 질문에 붙는 타인의 고찰 예시입니다.
- reflections는 정확히 3개이며, 각 항목은 줄바꿈 없는 한 문단으로 씁니다.
- 각 항목은 보통 3~5개의 짧은 문장 또는 호흡으로 구성합니다.
- 3문장도 허용하지만, 갑자기 끊긴 느낌이 나면 안 됩니다. 전제, 비틀기, 여운이 모두 자연스럽게 닫힐 때만 3문장으로 끝냅니다.
- 5문장은 생각의 층이 하나 더 필요할 때만 씁니다.
- 문장 중간에서 끊지 말고, JSON 문자열 안에 \\n 줄바꿈을 넣지 않습니다.
- reflections는 질문에 대한 정답이나 해설이 아니라, 사유하는 사람이 남긴 잠정적 메모처럼 씁니다.
- 첫 문장은 질문의 표면적 답을 반복하지 말고, 그 질문이 건드리는 전제나 긴장을 짚습니다.
- 중간 문장에는 익숙한 관점을 한 번 비틀거나, 사용자가 놓치기 쉬운 대가, 역설, 침묵, 반대편의 합리성을 보여줍니다.
- 마지막 문장은 결론을 닫지 말고, 더 생각하고 싶어지는 여운이나 다음 물음으로 끝냅니다.
- "필요가 있다", "때문이다", "해야 한다", "중요하다"처럼 결론을 닫는 종결을 피합니다.
- "처럼 보입니다", "일지도 모릅니다", "생각해볼 수 있습니다", "묻게 됩니다", "남습니다" 같은 열린 종결을 자연스럽게 섞습니다.
- 일부 고찰은 허를 찌르는 관점을 담되, 과장된 역설이나 냉소, 단정적인 훈계로 보이지 않게 합니다.
- 판단을 확정하기보다 전제, 긴장, 가능성, 망설임을 드러냅니다.`

const SYSTEM_PROMPT = [
  PERSONA,
  `당신은 Qraft입니다. 입력된 링크 본문이나 주제를 바탕으로 짧은 요약, 질문 3개, 각 질문의 고찰 예시를 한국어로 생성합니다.

규칙:
- 반드시 summary, questions, reflections 세 키를 모두 가진 JSON 객체 하나를 반환합니다.
- questions 배열만 단독으로 반환하지 않습니다.
- summary는 최대 6줄입니다.
- summary는 기본적으로 5~6줄로 씁니다. 너무 짧게 끝내지 않습니다.
- summary의 첫 3줄은 핵심 문장 3개입니다. 번호나 bullet을 붙이지 않습니다.
- summary의 4~6줄은 1~3번 구조화 요약으로 씁니다. 입력이 매우 짧아 구조화가 어색한 경우에만 생략합니다.
- summary에서 핵심 문장 3개 다음에 1. 쟁점이 이어질 경우, 그 사이에 반드시 빈 줄을 한 줄 넣습니다.
- summary 형식:
  핵심 문장 1
  핵심 문장 2
  핵심 문장 3

  1. 쟁점: 한 문장
  2. 변화: 한 문장
  3. 생각할 점: 한 문장
- 링크/긴 텍스트는 핵심 주장과 맥락을, 짧은 주제는 바라볼 관점을 요약합니다.
- 사용자 입력 원문에 있는 주제어를 잃지 말고, 참고 내용이 검색 결과일 때는 검색 결과의 잡음이나 광고성 문구를 핵심으로 삼지 않습니다.
- 링크 본문이나 검색 결과가 부족하면 모르는 사실을 꾸며내지 말고, 입력된 단어에서 직접 출발한 관점 중심 요약과 질문을 만듭니다.
- 유튜브 링크에서 영상 제목이나 채널 정보만 확보된 경우, 제목에서 드러나는 주제와 관점으로 요약과 질문을 만들되 "영상을 확인할 수 없습니다", "내용을 요약하기 어렵습니다", "일반적 맥락" 같은 한계 설명을 출력하지 않습니다.
- 유튜브 제목이나 채널 정보만 확보된 경우, 제목에 없는 작품 배경, 악기, 제작 의도, 인물 관계, 사건을 사실처럼 추가 추정하지 않습니다.
- 참고 내용에 없는 실존 인물의 이력, 사건, 수치, 소속, 작품명은 추가하지 않습니다.
- URL, 출처 표기, 검색 결과 문구, "Title:", "URL:", "Markdown Content:" 같은 수집 메타데이터를 출력하지 않습니다.
${QUESTION_DESIGN_RULES}
${REFLECTION_DESIGN_RULES}
- 실존 인물, 포지션, 기록, 소속 등 구체적 사실은 입력된 텍스트에 명시된 경우에만 사용합니다. 입력에 없는 사실은 추가하지 않습니다.
- 짧은 주제(인물명, 키워드 등)만 입력된 경우, 그 주제를 둘러싼 관점과 질문에 집중하며 검증되지 않은 사실을 단정하지 않습니다.
- 반드시 JSON 객체 형식으로만 반환합니다: {"summary":"요약 또는 관점 설명","questions":["질문1","질문2","질문3"],"reflections":["1번 질문 고찰","2번 질문 고찰","3번 질문 고찰"]}
- 설명, 부연, 마크다운 없이 JSON 객체만 출력합니다.`,
]
  .filter(Boolean)
  .join("\n\n")

const REGENERATE_SYSTEM_PROMPT = [
  PERSONA,
  `당신은 Qraft입니다. 입력된 요약을 바탕으로 기존과 다른 새로운 질문 3개와 각 질문의 고찰 예시를 한국어로 생성합니다.

규칙:
${QUESTION_DESIGN_RULES}
- 표면적인 재진술에 머물지 말고, 같은 요약 안에서 다른 각도나 더 선명한 갈등을 찾아 묻습니다.
- 이전 질문은 반복을 피하기 위한 참고일 뿐입니다. 억지로 새로워 보이려다 핵심 주제에서 멀어지지 않습니다.
- 이전 질문과 같은 문장, 거의 같은 문장, 표현만 바꾼 질문은 만들지 않습니다.
- 단, 반복 회피보다 새 질문의 자연스러움과 사유의 밀도를 우선합니다.
${REFLECTION_DESIGN_RULES}
- 반드시 JSON 객체 형식으로만 반환합니다: {"questions":["질문1","질문2","질문3"],"reflections":["1번 질문 고찰","2번 질문 고찰","3번 질문 고찰"]}
- 설명, 부연, 마크다운 없이 JSON 객체만 출력합니다.`,
]
  .filter(Boolean)
  .join("\n\n")

type QuestionRequest = {
  source?: unknown
  summary?: unknown
  previousQuestions?: unknown
}

const LINK_PARSE_FAILURE_MESSAGE =
  "링크의 내용을 파악하는 데 실패했습니다. 다시 시도하거나 키워드로 시작해 보시겠어요?"
const TOKEN_EXHAUSTED_CODE = "TOKEN_EXHAUSTED"
const TOKEN_EXHAUSTED_MESSAGE =
  "토큰이 다 떨어져서 질문을 생성할 수 없습니다. 금방 관리자의 사비를 들여 채워보도록하겠습니다.."

type TokenAlertPayload = {
  mode: "generate" | "regenerate"
  sourceKind?: SourceKind | "summary"
  request: Request
  error: unknown
}

function isUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function isYouTubeUrl(str: string): boolean {
  try {
    const url = new URL(str)
    const hostname = url.hostname.replace(/^www\./, "")

    return hostname === "youtube.com" || hostname === "youtu.be" || hostname.endsWith(".youtube.com")
  } catch {
    return false
  }
}

type YouTubeMetadata = {
  title?: string
  authorName?: string
}

async function fetchYouTubeMetadata(url: string): Promise<YouTubeMetadata | null> {
  const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(youtubeMetadataTimeoutMs),
  })

  if (!response.ok) {
    throw new Error(`YouTube oEmbed 요청 실패: ${response.status}`)
  }

  const payload: unknown = await response.json()

  if (!payload || typeof payload !== "object") {
    return null
  }

  const metadata = payload as { title?: unknown; author_name?: unknown }
  const title = typeof metadata.title === "string" ? metadata.title.trim() : ""
  const authorName = typeof metadata.author_name === "string" ? metadata.author_name.trim() : ""

  if (!title && !authorName) {
    return null
  }

  return {
    title: title || undefined,
    authorName: authorName || undefined,
  }
}

async function fetchViaJina(url: string, timeoutMs = jinaReaderTimeoutMs): Promise<string> {
  const headers: HeadersInit = {
    Accept: "text/plain",
  }

  if (process.env.JINA_API_KEY) {
    headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`
  }

  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers,
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`Jina 요청 실패: ${response.status}`)
  }

  const text = await response.text()
  return text.slice(0, contentCharacterLimit)
}

const FALLBACK_QUESTIONS = [
  "지금 가장 먼저 확인해야 할 쟁점은 무엇일까요?",
  "이 문제를 바라보기 전에 우리가 먼저 의심해야 할 전제는 무엇일까요?",
  "이 변화를 받아들일 때 무엇을 얻고 무엇을 잃게 될까요?",
]

const FALLBACK_SUMMARY =
  "입력된 내용을 하나의 사유 대상으로 바라보고, 그 안에 숨은 전제와 감정의 방향을 살펴봅니다."

const FALLBACK_REFLECTIONS = [
  "이 질문은 대상이 무엇을 말하는지보다 무엇을 말하지 않는지를 살피게 합니다. 답은 우리가 당연하게 넘긴 기준 쪽에 남아 있을지도 모릅니다.",
  "핵심은 주장 자체보다 그 주장이 기대고 있는 전제를 확인하는 데 있습니다. 어쩌면 내가 편하게 받아들인 확신이 더 많은 것을 가리고 있을지도 모릅니다.",
  "이 물음은 쉽게 결론을 내리기보다 우리가 어떤 태도로 이 문제를 응시하는지 묻습니다. 무엇을 잃지 않으려 하는지 남겨볼 수 있습니다.",
]

function normalizeSummary(summary: string) {
  const lines = summary
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6)

  return (lines.length ? lines.join("\n") : FALLBACK_SUMMARY)
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n(?!\n)(?=1\.\s)/, "\n\n")
}

function isUnavailableDisclosure(value: string) {
  return /(확인할 수 없습니다|제공되지 않아|포함되지 않아|요약하기 어렵|일반적 맥락|직접 확인)/.test(value)
}

function removeUnavailableDisclosure(summary: string) {
  return summary
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => !isUnavailableDisclosure(line))
    .join("\n")
    .trim()
}

function cleanGeneratedItem(item: string) {
  return item
    .replace(/^\s*(?:[-*•]+|\d+[.)])\s*/, "")
    .replace(/[ \t]+/g, " ")
    .trim()
}

function softenQuestionTone(item: string) {
  return cleanGeneratedItem(item)
    .replace(/무엇인가요[?？]$/u, "무엇일까요?")
    .replace(/누구인가요[?？]$/u, "누구일까요?")
    .replace(/어디인가요[?？]$/u, "어디일까요?")
    .replace(/언제인가요[?？]$/u, "언제일까요?")
    .replace(/왜인가요[?？]$/u, "왜일까요?")
    .replace(/있는가요[?？]$/u, "있을까요?")
    .replace(/없는가요[?？]$/u, "없을까요?")
    .replace(/되는가요[?？]$/u, "될까요?")
    .replace(/가능한가요[?？]$/u, "가능할까요?")
    .replace(/타당한가요[?？]$/u, "타당할까요?")
    .replace(/중요한가요[?？]$/u, "중요할까요?")
    .replace(/인가요[?？]$/u, "일까요?")
    .replace(/한가요[?？]$/u, "할까요?")
}

function cleanReflectionLine(line: string) {
  return line
    .replace(/^\s*(?:[-*•]+|\d+[.)])\s*/, "")
    .replace(/[ \t]+/g, " ")
    .trim()
}

function softenReflection(item: string) {
  const cleaned = item
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map(cleanReflectionLine)
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()

  const softened = cleaned
    .replace(/필요가 있다\.?$/u, "필요가 있을지도 모릅니다.")
    .replace(/때문이다\.?$/u, "때문일지도 모릅니다.")
    .replace(/해야 한다\.?$/u, "해야 하는지 묻게 됩니다.")
    .replace(/중요하다\.?$/u, "중요해 보입니다.")
    .replace(/볼 수 있다\.?$/u, "볼 수 있습니다.")

  const sentences = softened
    .match(/[^.!?。！？]+[.!?。！？]?/gu)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) ?? [softened]

  return sentences.slice(0, 5).join(" ").replace(/\s+/g, " ").trim()
}

function normalizeList(items: string[], fallback: string[]) {
  return [
    ...items
      .map(softenQuestionTone)
      .filter((item) => item.length > 0 && !isUnavailableDisclosure(item))
      .slice(0, 3),
    ...fallback,
  ].slice(0, 3)
}

function normalizeReflections(items: string[], fallback: string[]) {
  return [
    ...items
      .map(softenReflection)
      .filter((item) => item.length > 0 && !isUnavailableDisclosure(item))
      .slice(0, 3),
    ...fallback,
  ].slice(0, 3)
}

type SourceKind = "url" | "youtube" | "topic" | "text"

function getSourceKind(source: string): SourceKind {
  if (isYouTubeUrl(source)) return "youtube"
  if (isUrl(source)) return "url"
  return source.length < 100 ? "topic" : "text"
}

function normalizeQuestionFingerprint(question: string) {
  return question
    .replace(/[?？!！.,，。'"“”‘’()\[\]{}:;·…\s]/g, "")
    .toLowerCase()
}

function getQuestionShingles(question: string) {
  const fingerprint = normalizeQuestionFingerprint(question)
  const shingles = new Set<string>()

  if (fingerprint.length < 3) {
    if (fingerprint) shingles.add(fingerprint)
    return shingles
  }

  for (let index = 0; index <= fingerprint.length - 3; index += 1) {
    shingles.add(fingerprint.slice(index, index + 3))
  }

  return shingles
}

function getQuestionSimilarity(question: string, previousQuestion: string) {
  const questionShingles = getQuestionShingles(question)
  const previousQuestionShingles = getQuestionShingles(previousQuestion)

  if (questionShingles.size === 0 || previousQuestionShingles.size === 0) return 0

  let intersectionSize = 0
  questionShingles.forEach((shingle) => {
    if (previousQuestionShingles.has(shingle)) {
      intersectionSize += 1
    }
  })

  return intersectionSize / (questionShingles.size + previousQuestionShingles.size - intersectionSize)
}

function isRepeatedQuestion(question: string, previousQuestions: string[]) {
  const fingerprint = normalizeQuestionFingerprint(question)

  if (!fingerprint) return false

  return previousQuestions.some((previousQuestion) => {
    const previousFingerprint = normalizeQuestionFingerprint(previousQuestion)

    if (previousFingerprint === fingerprint) return true
    if (fingerprint.length < 14 || previousFingerprint.length < 14) return false

    return getQuestionSimilarity(question, previousQuestion) >= 0.72
  })
}

function buildRegenerateModelInput(summary: string, previousQuestions: string[]) {
  const parts = [`요약:\n${summary}`]
  const recentQuestions = previousQuestions.slice(-previousQuestionLimit)

  if (recentQuestions.length > 0) {
    parts.push(
      [
        "최근 생성된 질문:",
        ...recentQuestions.map((question, index) => `${index + 1}. ${question}`),
        "",
        "위 질문은 반복을 피하기 위한 참고용입니다.",
        "같은 문장이나 표현만 바꾼 질문은 피하세요.",
        "이전 질문이 이미 다룬 핵심 소재나 대립 구도를 새 질문의 중심에 다시 놓지 마세요.",
        "핵심 주제에서 멀어지지 말고, 실패 조건, 숨은 대가, 시간축, 관계, 감각의 변화, 반대편의 합리성 중 다른 렌즈를 선택하세요.",
        "이전 질문을 억지로 피하느라 어색하거나 주변적인 질문을 만들지 마세요.",
      ].join("\n")
    )
  }

  return parts.join("\n\n")
}

function buildModelInput({
  source,
  content,
  sourceKind,
  resolved,
}: {
  source: string
  content: string
  sourceKind: SourceKind
  resolved: boolean
}) {
  const sourceLabel =
    sourceKind === "youtube"
      ? "유튜브 링크"
      : sourceKind === "url"
        ? "링크"
        : sourceKind === "topic"
          ? "짧은 주제"
          : "긴 텍스트"
  const usableContent = content.trim().slice(0, contentCharacterLimit)
  const contentGuide =
    sourceKind === "topic"
      ? "참고 내용: 짧은 주제입니다. 사용자 원문 자체를 사유 대상으로 삼고, 검증되지 않은 사실을 덧붙이지 마세요."
      : "참고 내용: 충분히 확보되지 않았습니다. 사용자 원문에서 확인할 수 있는 범위를 넘어서 단정하지 마세요."

  return [
    `입력 유형: ${sourceLabel}`,
    `사용자 원문:\n${source}`,
    resolved && usableContent && usableContent !== source
      ? `참고 내용:\n${usableContent}`
      : contentGuide,
  ].join("\n\n")
}

function buildYouTubeContent(metadata: YouTubeMetadata | null, readerContent: string) {
  const parts: string[] = []
  const cleanedReaderContent = readerContent.trim()

  if (metadata?.title) {
    parts.push(`영상 제목: ${metadata.title}`)
  }

  if (metadata?.authorName) {
    parts.push(`채널 또는 발화자: ${metadata.authorName}`)
  }

  if (cleanedReaderContent && cleanedReaderContent !== metadata?.title) {
    parts.push(`추가 참고 내용:\n${cleanedReaderContent}`)
  }

  return parts.join("\n\n")
}

function linkParseFailureResponse() {
  return Response.json(
    {
      message: LINK_PARSE_FAILURE_MESSAGE,
      code: "LINK_PARSE_FAILED",
      retryable: true,
    },
    { status: 422 }
  )
}

function getErrorParts(error: unknown) {
  const parts: string[] = []

  if (error instanceof Error) {
    parts.push(error.message)
  }

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>

    if (typeof record.type === "string") {
      parts.push(record.type)
    }
    if (typeof record.status === "number") {
      parts.push(String(record.status))
    }

    const apiError = record.error
    if (apiError && typeof apiError === "object") {
      const apiErrorRecord = apiError as Record<string, unknown>

      if (typeof apiErrorRecord.type === "string") {
        parts.push(apiErrorRecord.type)
      }
      if (typeof apiErrorRecord.message === "string") {
        parts.push(apiErrorRecord.message)
      }
    }
  }

  return parts
}

function isTokenExhaustedError(error: unknown) {
  const text = getErrorParts(error).join(" ").toLowerCase()

  return (
    text.includes("billing_error") ||
    text.includes("insufficient_quota") ||
    text.includes("credit") ||
    text.includes("balance") ||
    text.includes("billing") ||
    text.includes("quota") ||
    text.includes("spend limit")
  )
}

function tokenExhaustedResponse() {
  return Response.json(
    {
      message: TOKEN_EXHAUSTED_MESSAGE,
      code: TOKEN_EXHAUSTED_CODE,
      retryable: false,
    },
    { status: 402 }
  )
}

async function notifyTokenExhausted({ mode, sourceKind, request, error }: TokenAlertPayload) {
  const errorSummary = getErrorParts(error).join(" | ")
  const alertText = `[Qraft] 토큰/크레딧 부족으로 질문 생성 실패 (${mode})`
  const path = new URL(request.url).pathname
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null
  const payload = {
    text: alertText,
    content: alertText,
    event: "qraft_token_exhausted",
    mode,
    sourceKind,
    path,
    userAgent,
    error: errorSummary.slice(0, 1000),
    createdAt: new Date().toISOString(),
  }
  const webhookUrl = process.env.QRAFT_TOKEN_ALERT_WEBHOOK_URL?.trim()

  console.error("Qraft token alert", payload)

  try {
    const { supabase } = await createRouteClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from("token_alerts").insert({
      user_id: user?.id ?? null,
      event: payload.event,
      mode,
      source_kind: sourceKind ?? null,
      page_path: path,
      user_agent: userAgent,
      error: payload.error,
    })

    if (insertError) {
      console.error("Qraft token alert Supabase insert failed", insertError)
    }
  } catch (supabaseError) {
    console.error("Qraft token alert Supabase insert failed", supabaseError)
  }

  if (!webhookUrl) return

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(4000),
    })
  } catch (notificationError) {
    console.error("Qraft token alert failed", notificationError)
  }
}

export async function POST(request: Request) {
  let body: QuestionRequest

  try {
    body = (await request.json()) as QuestionRequest
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }

  const source = typeof body.source === "string" ? body.source.trim() : ""
  const existingSummary = typeof body.summary === "string" ? body.summary.trim() : ""
  const previousQuestions = Array.isArray(body.previousQuestions)
    ? body.previousQuestions
        .filter((question): question is string => typeof question === "string")
        .map((question) => cleanGeneratedItem(question))
        .filter(Boolean)
        .slice(-previousQuestionLimit)
    : []

  if (!source && !existingSummary) {
    return Response.json({ message: "Source is required" }, { status: 400 })
  }

  // 재생성 모드: 기존 요약으로 질문+고찰만 생성
  if (existingSummary) {
    let raw = ""
    const regenerateInput = buildRegenerateModelInput(existingSummary, previousQuestions)

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: regenerationMaxTokens,
        temperature: 0.35,
        system: REGENERATE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: regenerateInput }],
      })

      raw = response.content[0].type === "text" ? response.content[0].text.trim() : ""
    } catch (error) {
      console.error(error)
      if (isTokenExhaustedError(error)) {
        await notifyTokenExhausted({ mode: "regenerate", sourceKind: "summary", request, error })
        return tokenExhaustedResponse()
      }

      return Response.json({ questions: FALLBACK_QUESTIONS, reflections: FALLBACK_REFLECTIONS })
    }

    let questions: string[] = FALLBACK_QUESTIONS
    let reflections: string[] = FALLBACK_REFLECTIONS

    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      const parsed: unknown = JSON.parse(jsonMatch ? jsonMatch[0] : raw)

      if (parsed && typeof parsed === "object" && "questions" in parsed) {
        const payload = parsed as { questions?: unknown; reflections?: unknown }

        if (Array.isArray(payload.questions) && payload.questions.every((q) => typeof q === "string")) {
          questions = payload.questions
        }
        if (Array.isArray(payload.reflections) && payload.reflections.every((r) => typeof r === "string")) {
          reflections = payload.reflections
        }
      }
    } catch {}

    questions = normalizeList(questions, FALLBACK_QUESTIONS)
    reflections = normalizeReflections(reflections, FALLBACK_REFLECTIONS)

    if (previousQuestions.length > 0 && questions.some((question) => isRepeatedQuestion(question, previousQuestions))) {
      raw = ""

      try {
        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: regenerationMaxTokens,
          temperature: 0.45,
          system: REGENERATE_SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: [
                regenerateInput,
                "방금 생성된 질문이 이전 질문과 겹쳤습니다.",
                "중심 주제는 유지하되, 이전 질문의 핵심 소재나 대립 구도를 반복하지 말고 실패 조건, 숨은 대가, 시간축, 관계, 감각의 변화 중 하나로 렌즈를 바꾸어 다시 만드세요.",
              ].join("\n\n"),
            },
          ],
        })

        raw = response.content[0].type === "text" ? response.content[0].text.trim() : ""
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        const parsed: unknown = JSON.parse(jsonMatch ? jsonMatch[0] : raw)

        if (parsed && typeof parsed === "object" && "questions" in parsed) {
          const payload = parsed as { questions?: unknown; reflections?: unknown }

          if (Array.isArray(payload.questions) && payload.questions.every((q) => typeof q === "string")) {
            questions = normalizeList(payload.questions, FALLBACK_QUESTIONS)
          }
          if (Array.isArray(payload.reflections) && payload.reflections.every((r) => typeof r === "string")) {
            reflections = normalizeReflections(payload.reflections, FALLBACK_REFLECTIONS)
          }
        }
      } catch (error) {
        console.error("Qraft regenerate duplicate retry failed", error)
      }
    }

    return Response.json({
      questions,
      reflections,
    })
  }

  // 최초 생성 모드
  let content: string
  let contentResolved = true
  const sourceKind = getSourceKind(source)

  if (sourceKind === "youtube") {
    const [readerResult, metadataResult] = await Promise.allSettled([
      fetchViaJina(source, youtubeReaderTimeoutMs),
      fetchYouTubeMetadata(source),
    ])
    const readerContent = readerResult.status === "fulfilled" ? readerResult.value : ""
    const metadata = metadataResult.status === "fulfilled" ? metadataResult.value : null

    content = buildYouTubeContent(metadata, readerContent)
    contentResolved = Boolean(content.trim())
  } else if (sourceKind === "url") {
    try {
      content = await fetchViaJina(source)
    } catch {
      content = source
      contentResolved = false
    }
  } else if (sourceKind === "topic") {
    content = source
    contentResolved = false
  } else {
    content = source
  }

  if ((sourceKind === "url" || sourceKind === "youtube") && !contentResolved) {
    return linkParseFailureResponse()
  }

  const modelInput = buildModelInput({
    source,
    content,
    sourceKind,
    resolved: contentResolved && content.trim().length > 0,
  })

  let raw = ""

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: generationMaxTokens,
      temperature: 0.35,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: modelInput }],
    })

    raw = response.content[0].type === "text" ? response.content[0].text.trim() : ""
  } catch (error) {
    console.error(error)
    if (isTokenExhaustedError(error)) {
      await notifyTokenExhausted({ mode: "generate", sourceKind, request, error })
      return tokenExhaustedResponse()
    }

    return Response.json({
      summary: FALLBACK_SUMMARY,
      questions: FALLBACK_QUESTIONS,
      reflections: FALLBACK_REFLECTIONS,
    })
  }

  let summary = FALLBACK_SUMMARY
  let questions: string[] = FALLBACK_QUESTIONS
  let reflections: string[] = FALLBACK_REFLECTIONS

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/) ?? raw.match(/\[[\s\S]*\]/)
    const parsed: unknown = JSON.parse(jsonMatch ? jsonMatch[0] : raw)

    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every((q) => typeof q === "string")
    ) {
      questions = parsed as string[]
    } else if (
      parsed &&
      typeof parsed === "object" &&
      "summary" in parsed &&
      "questions" in parsed
    ) {
      const payload = parsed as { summary?: unknown; questions?: unknown; reflections?: unknown }

      if (typeof payload.summary === "string" && payload.summary.trim()) {
        summary = normalizeSummary(removeUnavailableDisclosure(payload.summary))
      }

      if (
        Array.isArray(payload.questions) &&
        payload.questions.length > 0 &&
        payload.questions.every((q) => typeof q === "string")
      ) {
        questions = payload.questions
      }

      if (
        Array.isArray(payload.reflections) &&
        payload.reflections.length > 0 &&
        payload.reflections.every((reflection) => typeof reflection === "string")
      ) {
        reflections = payload.reflections
      }
    }
  } catch {}

  questions = normalizeList(questions, FALLBACK_QUESTIONS)
  reflections = normalizeReflections(reflections, FALLBACK_REFLECTIONS)
  summary = normalizeSummary(removeUnavailableDisclosure(summary))

  return Response.json({ summary, questions, reflections })
}
