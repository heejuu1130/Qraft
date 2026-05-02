import Anthropic from "@anthropic-ai/sdk"
import { createRouteClient } from "@/lib/supabase/route"

const client = new Anthropic({ timeout: 30000 })

const PERSONA = `Qraft의 문체:
- 차분하고 단정한 한국어 문어체를 씁니다.
- 모호한 감상보다 핵심 쟁점, 태도, 전제를 정확히 짚습니다.
- 어려운 단어는 필요할 때만 쓰고, 질문은 자연스럽게 읽혀야 합니다.`

const SYSTEM_PROMPT = [
  PERSONA,
  `당신은 Qraft입니다. 입력된 링크 본문이나 주제를 바탕으로 짧은 요약, 질문 3개, 각 질문의 고찰 예시를 한국어로 생성합니다.

규칙:
- summary는 최대 6줄입니다.
- summary의 첫 3줄은 핵심 문장 3개입니다. 번호나 bullet을 붙이지 않습니다.
- summary의 4~6줄은 필요할 때만 1~3번 구조화 요약으로 씁니다.
- summary에서 핵심 문장 3개 다음에 1. 쟁점이 이어질 경우, 그 사이에 반드시 빈 줄을 한 줄 넣습니다.
- summary 형식:
  핵심 문장 1
  핵심 문장 2
  핵심 문장 3

  1. 쟁점: 한 문장
  2. 변화: 한 문장
  3. 생각할 점: 한 문장
- summary는 링크/긴 텍스트라면 핵심 주장과 맥락을, 짧은 주제라면 바라볼 관점을 요약합니다.
- 사용자 입력 원문에 있는 주제어를 잃지 말고, 참고 내용이 검색 결과일 때는 검색 결과의 잡음이나 광고성 문구를 핵심으로 삼지 않습니다.
- 링크 본문이나 검색 결과가 부족하면 모르는 사실을 꾸며내지 말고, 입력된 단어에서 직접 출발한 관점 중심 요약과 질문을 만듭니다.
- 유튜브 링크에서 영상 제목이나 채널 정보만 확보된 경우, 제목에서 드러나는 주제와 관점으로 요약과 질문을 만들되 "영상을 확인할 수 없습니다", "내용을 요약하기 어렵습니다", "일반적 맥락" 같은 한계 설명을 출력하지 않습니다.
- 참고 내용에 없는 실존 인물의 이력, 사건, 수치, 소속, 작품명은 추가하지 않습니다.
- URL, 출처 표기, 검색 결과 문구, "Title:", "URL:", "Markdown Content:" 같은 수집 메타데이터를 출력에 포함하지 않습니다.
- 정확히 3개의 질문을 생성합니다.
- 질문은 콘텐츠 자체의 감상평을 묻지 말고, 내용에서 나온 고민할 만한 주제를 묻습니다.
- "이 영상", "이 글", "이 인터뷰"라는 표현은 질문에 쓰지 않습니다.
- 짧은 주제만 입력된 경우 질문은 너무 일반적인 인생 질문으로 흐르지 말고, 입력 주제의 긴장, 선택, 관점 차이를 묻습니다.
- 1번 질문은 쉽고 짧은 진입 질문입니다.
- 2번 질문은 핵심 쟁점을 이해했는지 묻는 보통 난이도 질문입니다.
- 3번 질문은 더 오래 생각해야 하는 깊은 질문입니다.
- 질문은 자연스러워야 하며, 문학적 수사를 과하게 쓰지 않습니다.
- reflections는 각 질문에 대한 가능한 고찰 예시입니다.
- reflections는 정확히 3개이며, 각 항목은 2문장 이내, 한국어 기준 90자 안팎으로 씁니다.
- reflections는 질문에 대한 정답이나 해설이 아니라, 사유하는 사람이 남긴 잠정적 메모처럼 씁니다.
- reflections는 "필요가 있다", "때문이다", "해야 한다", "중요하다"처럼 결론을 닫는 종결을 피합니다.
- reflections는 "처럼 보입니다", "일지도 모릅니다", "생각해볼 수 있습니다", "묻게 됩니다", "남습니다" 같은 열린 종결을 자연스럽게 섞습니다.
- reflections는 판단을 확정하기보다 전제, 긴장, 가능성, 망설임을 드러냅니다.
- reflections는 전체가 의문문으로만 보이지 않게 하되, 마지막 문장은 닫힌 결론보다 여운이나 다음 질문으로 끝냅니다.
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
- 정확히 3개의 질문을 생성합니다.
- 질문은 콘텐츠 자체의 감상평을 묻지 말고, 내용에서 나온 고민할 만한 주제를 묻습니다.
- "이 영상", "이 글", "이 인터뷰"라는 표현은 질문에 쓰지 않습니다.
- 1번 질문은 쉽고 짧은 진입 질문입니다.
- 2번 질문은 핵심 쟁점을 이해했는지 묻는 보통 난이도 질문입니다.
- 3번 질문은 더 오래 생각해야 하는 깊은 질문입니다.
- 질문은 자연스러워야 하며, 문학적 수사를 과하게 쓰지 않습니다.
- reflections는 각 질문에 대한 가능한 고찰 예시입니다.
- reflections는 정확히 3개이며, 각 항목은 2문장 이내, 한국어 기준 90자 안팎으로 씁니다.
- reflections는 질문에 대한 정답이나 해설이 아니라, 사유하는 사람이 남긴 잠정적 메모처럼 씁니다.
- reflections는 "필요가 있다", "때문이다", "해야 한다", "중요하다"처럼 결론을 닫는 종결을 피합니다.
- reflections는 "처럼 보입니다", "일지도 모릅니다", "생각해볼 수 있습니다", "묻게 됩니다", "남습니다" 같은 열린 종결을 자연스럽게 섞습니다.
- reflections는 판단을 확정하기보다 전제, 긴장, 가능성, 망설임을 드러냅니다.
- reflections는 전체가 의문문으로만 보이지 않게 하되, 마지막 문장은 닫힌 결론보다 여운이나 다음 질문으로 끝냅니다.
- 반드시 JSON 객체 형식으로만 반환합니다: {"questions":["질문1","질문2","질문3"],"reflections":["1번 질문 고찰","2번 질문 고찰","3번 질문 고찰"]}
- 설명, 부연, 마크다운 없이 JSON 객체만 출력합니다.`,
]
  .filter(Boolean)
  .join("\n\n")

type QuestionRequest = {
  source?: unknown
  summary?: unknown
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
    signal: AbortSignal.timeout(5000),
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

async function fetchViaJina(url: string): Promise<string> {
  const headers: HeadersInit = {
    Accept: "text/plain",
  }

  if (process.env.JINA_API_KEY) {
    headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`
  }

  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers,
    signal: AbortSignal.timeout(8000),
  })

  if (!response.ok) {
    throw new Error(`Jina 요청 실패: ${response.status}`)
  }

  const text = await response.text()
  return text.slice(0, 8000)
}

async function searchViaJina(query: string): Promise<string> {
  const headers: HeadersInit = {
    Accept: "text/plain",
  }

  if (process.env.JINA_API_KEY) {
    headers.Authorization = `Bearer ${process.env.JINA_API_KEY}`
  }

  const response = await fetch(`https://s.jina.ai/${encodeURIComponent(query)}`, {
    headers,
    signal: AbortSignal.timeout(6000),
  })

  if (!response.ok) {
    throw new Error(`Jina 검색 실패: ${response.status}`)
  }

  const text = await response.text()
  return text.slice(0, 8000)
}

const FALLBACK_QUESTIONS = [
  "지금 가장 먼저 확인해야 할 쟁점은 무엇인가요?",
  "이 문제를 바라보는 우리의 전제는 충분히 타당한가요?",
  "이 변화 앞에서 인간이 지켜야 할 태도는 무엇일까요?",
]

const FALLBACK_SUMMARY =
  "입력된 내용을 하나의 사유 대상으로 바라보고, 그 안에 숨은 전제와 감정의 방향을 살펴봅니다."

const FALLBACK_REFLECTIONS = [
  "이 질문은 먼저 대상이 무엇을 말하는지보다, 무엇을 말하지 않는지를 살피게 합니다.",
  "핵심은 주장 자체보다 그 주장이 기대고 있는 전제를 차분히 확인하는 데 있습니다.",
  "이 물음은 쉽게 결론을 내리기보다, 우리가 어떤 태도로 이 문제를 응시해야 하는지 묻습니다.",
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

function softenReflection(item: string) {
  const softened = cleanGeneratedItem(item)
    .replace(/필요가 있다\.?$/u, "필요가 있을지도 모릅니다.")
    .replace(/때문이다\.?$/u, "때문일지도 모릅니다.")
    .replace(/해야 한다\.?$/u, "해야 하는지 묻게 됩니다.")
    .replace(/중요하다\.?$/u, "중요해 보입니다.")
    .replace(/볼 수 있다\.?$/u, "볼 수 있습니다.")

  const sentences = softened.match(/[^.!?。！？]+[.!?。！？]?/gu) ?? [softened]
  const shortened = sentences.slice(0, 2).join("").trim()

  return shortened.length > 120 ? `${shortened.slice(0, 117).trim()}...` : shortened
}

function normalizeList(items: string[], fallback: string[]) {
  return [
    ...items
      .map(cleanGeneratedItem)
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
  const usableContent = content.trim().slice(0, 8000)

  return [
    `입력 유형: ${sourceLabel}`,
    `사용자 원문:\n${source}`,
    resolved && usableContent && usableContent !== source
      ? `참고 내용:\n${usableContent}`
      : "참고 내용: 충분히 확보되지 않았습니다. 사용자 원문에서 확인할 수 있는 범위를 넘어서 단정하지 마세요.",
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

  if (!source && !existingSummary) {
    return Response.json({ message: "Source is required" }, { status: 400 })
  }

  // 재생성 모드: 기존 요약으로 질문+고찰만 생성
  if (existingSummary) {
    let raw = ""

    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        temperature: 0.35,
        system: REGENERATE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: existingSummary }],
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

    return Response.json({
      questions: normalizeList(questions, FALLBACK_QUESTIONS),
      reflections: normalizeReflections(reflections, FALLBACK_REFLECTIONS),
    })
  }

  // 최초 생성 모드
  let content: string
  let contentResolved = true
  const sourceKind = getSourceKind(source)

  if (sourceKind === "youtube") {
    const [readerResult, metadataResult] = await Promise.allSettled([
      fetchViaJina(source),
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
    try {
      content = await searchViaJina(source)
    } catch {
      content = source
      contentResolved = false
    }
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
      max_tokens: 1200,
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
