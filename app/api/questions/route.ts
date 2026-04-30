import Anthropic from "@anthropic-ai/sdk"

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
- summary 형식:
  핵심 문장 1
  핵심 문장 2
  핵심 문장 3
  1. 쟁점: 한 문장
  2. 변화: 한 문장
  3. 생각할 점: 한 문장
- summary는 링크/긴 텍스트라면 핵심 주장과 맥락을, 짧은 주제라면 바라볼 관점을 요약합니다.
- 정확히 3개의 질문을 생성합니다.
- 질문은 콘텐츠 자체의 감상평을 묻지 말고, 내용에서 나온 고민할 만한 주제를 묻습니다.
- "이 영상", "이 글", "이 인터뷰"라는 표현은 질문에 쓰지 않습니다.
- 1번 질문은 쉽고 짧은 진입 질문입니다.
- 2번 질문은 핵심 쟁점을 이해했는지 묻는 보통 난이도 질문입니다.
- 3번 질문은 더 오래 생각해야 하는 깊은 질문입니다.
- 질문은 자연스러워야 하며, 문학적 수사를 과하게 쓰지 않습니다.
- reflections는 각 질문에 대한 가능한 고찰 예시입니다.
- reflections는 정확히 3개이며, 각 항목은 화면 기준 최대 3줄 분량입니다.
- reflections는 질문에 대한 짧은 예시 답변처럼 작성하되, 정답처럼 단정하지 않습니다.
- reflections는 핵심 판단 1문장과 그 판단을 뒷받침하는 이유 1~2문장으로 구성합니다.
- reflections는 모두 마침표로 닫힌 결론처럼 끝내지 않습니다.
- reflections 중 일부는 후속 질문, 열린 가능성, 다른 관점으로 이어지는 문장으로 마무리합니다.
- 다만 reflections 전체가 의문문으로만 보이지 않게, 단정형과 질문형을 자연스럽게 섞습니다.
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
- reflections는 정확히 3개이며, 각 항목은 화면 기준 최대 3줄 분량입니다.
- reflections는 질문에 대한 짧은 예시 답변처럼 작성하되, 정답처럼 단정하지 않습니다.
- reflections는 핵심 판단 1문장과 그 판단을 뒷받침하는 이유 1~2문장으로 구성합니다.
- reflections는 모두 마침표로 닫힌 결론처럼 끝내지 않습니다.
- reflections 중 일부는 후속 질문, 열린 가능성, 다른 관점으로 이어지는 문장으로 마무리합니다.
- 다만 reflections 전체가 의문문으로만 보이지 않게, 단정형과 질문형을 자연스럽게 섞습니다.
- 반드시 JSON 객체 형식으로만 반환합니다: {"questions":["질문1","질문2","질문3"],"reflections":["1번 질문 고찰","2번 질문 고찰","3번 질문 고찰"]}
- 설명, 부연, 마크다운 없이 JSON 객체만 출력합니다.`,
]
  .filter(Boolean)
  .join("\n\n")

type QuestionRequest = {
  source?: unknown
  summary?: unknown
}

function isUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
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

function normalizeList(items: string[], fallback: string[]) {
  return [...items.filter((item) => item.trim()).slice(0, 3), ...fallback].slice(0, 3)
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
        system: REGENERATE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: existingSummary }],
      })

      raw = response.content[0].type === "text" ? response.content[0].text.trim() : ""
    } catch (error) {
      console.error(error)
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
      reflections: normalizeList(reflections, FALLBACK_REFLECTIONS),
    })
  }

  // 최초 생성 모드
  let content: string

  if (isUrl(source)) {
    try {
      content = await fetchViaJina(source)
    } catch {
      content = source
    }
  } else if (source.length < 100) {
    try {
      content = await searchViaJina(source)
    } catch {
      content = source
    }
  } else {
    content = source
  }

  let raw = ""

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content }],
    })

    raw = response.content[0].type === "text" ? response.content[0].text.trim() : ""
  } catch (error) {
    console.error(error)
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
        summary = payload.summary.trim()
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
  reflections = normalizeList(reflections, FALLBACK_REFLECTIONS)

  return Response.json({ summary, questions, reflections })
}
