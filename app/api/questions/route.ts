import Anthropic from "@anthropic-ai/sdk"
import { createHash } from "crypto"
import { createRouteClient } from "@/lib/supabase/route"

const client = new Anthropic({ timeout: 30000 })
const sonnetGenerationModel = "claude-sonnet-4-6"
const fastGenerationModel = "claude-haiku-4-5"
const contentCharacterLimit = 8000
const jinaReaderTimeoutMs = 8000
const youtubeReaderTimeoutMs = 5000
const youtubeMetadataTimeoutMs = 5000
const generationMaxTokens = 1250
const groundedGenerationMaxTokens = 1650
const geminiRouterTimeoutMs = 1800
const geminiRouterMaxTokens = 160
const regenerationMaxTokens = 950
const previousQuestionLimit = 8
const topicWebSearchMaxUses = 1
const questionRateLimitWindowMs = 60 * 60 * 1000
const questionRateLimitMaxRequests = 30
const questionRateLimitMaxEntries = 1000
const cacheFreshnessTtlMs = 12 * 60 * 60 * 1000
const cacheFactualTopicTtlMs = 24 * 60 * 60 * 1000
const cacheTopicTtlMs = 3 * 24 * 60 * 60 * 1000
const cacheLinkTtlMs = 7 * 24 * 60 * 60 * 1000
const questionCacheVersion = "v6"
const factualTopicKeywords = [
  "ceo",
  "앱",
  "공연",
  "gpt",
  "가격",
  "가게",
  "게임",
  "가수",
  "감독",
  "개봉",
  "교수",
  "기업",
  "기록",
  "근황",
  "날씨",
  "뉴스",
  "논문",
  "논란",
  "대통령",
  "대학교",
  "대표",
  "드라마",
  "디자이너",
  "매출",
  "모델",
  "배우",
  "브랜드",
  "사건",
  "사고",
  "서비스",
  "선거",
  "선수",
  "성적",
  "소설",
  "스타",
  "스타트업",
  "스펙",
  "시리즈",
  "아티스트",
  "아이돌",
  "앨범",
  "영화",
  "올해",
  "운동선수",
  "웹툰",
  "유튜버",
  "인스타",
  "인플루언서",
  "인물",
  "작가",
  "작품",
  "전쟁",
  "전시",
  "전시회",
  "저자",
  "정책",
  "정치인",
  "제품",
  "주가",
  "출연",
  "최근",
  "출시",
  "크리에이터",
  "팀",
  "평점",
  "플랫폼",
  "학력",
  "후기",
  "후보",
  "회사",
]

const externalReferenceKeywords = [
  "검색",
  "공식",
  "기사",
  "누구",
  "랭킹",
  "리뷰",
  "사실",
  "순위",
  "알려",
  "얼마",
  "업데이트",
  "요즘",
  "위키",
  "자료",
  "정보",
  "추천",
  "출처",
  "확인",
]

const abstractTopicKeywords = [
  "감정",
  "감각",
  "갈등",
  "고독",
  "공감",
  "공동체",
  "공간",
  "관계",
  "기억",
  "기술",
  "경제",
  "교육",
  "나",
  "노동",
  "도파민",
  "데이터",
  "디자인",
  "돈",
  "돌봄",
  "마음",
  "문화",
  "민주주의",
  "분노",
  "불안",
  "사랑",
  "삶",
  "사회",
  "상실",
  "선택",
  "성공",
  "소외",
  "소비",
  "시간",
  "실패",
  "실존",
  "알고리즘",
  "언어",
  "예술",
  "욕망",
  "우울",
  "우정",
  "윤리",
  "의미",
  "인간성",
  "자아",
  "자본주의",
  "자유",
  "정치",
  "정의",
  "정체성",
  "주체성",
  "존재",
  "창작",
  "죽음",
  "책임",
  "철학",
  "침묵",
  "취향",
  "커리어",
  "편집",
  "피로",
  "허무",
  "혐오",
  "행복",
]

const abstractLatinTopics = [
  "alienation",
  "anxiety",
  "art",
  "capitalism",
  "community",
  "culture",
  "death",
  "democracy",
  "desire",
  "ethics",
  "freedom",
  "identity",
  "language",
  "loneliness",
  "love",
  "memory",
  "modernity",
  "philosophy",
  "self",
]

const knownStandaloneWorkTitles = [
  "1984",
  "노인과 바다",
  "데미안",
  "동물농장",
  "멋진 신세계",
  "변신",
  "어린 왕자",
  "위대한 개츠비",
  "이방인",
  "참을 수 없는 존재의 가벼움",
  "타인의 고통",
]

const factualRouterPrototypes = [
  "실존 인물의 근황",
  "배우 출연 작품",
  "가수 앨범 활동",
  "브랜드 출시 정보",
  "기업 매출과 대표",
  "제품 가격과 스펙",
  "영화 개봉 정보",
  "드라마 출연진",
  "유튜버 채널 정보",
  "정치인 선거 이력",
  "선수 기록과 소속팀",
  "최근 뉴스 사건",
  "전시회 일정과 장소",
  "앱 서비스 업데이트",
  "책 저자와 출간 정보",
  "작품 줄거리와 평점",
  "주가와 시장 반응",
  "대학교 교수 이력",
  "맛집 리뷰와 위치",
  "여행지 날씨와 후기",
]

const abstractRouterPrototypes = [
  "좋은 삶의 의미",
  "사랑과 관계의 기준",
  "현대인의 고독",
  "불안과 욕망",
  "자유와 책임",
  "기술과 인간성",
  "알고리즘과 취향",
  "소비와 정체성",
  "돈과 행복",
  "일과 커리어의 의미",
  "성공과 실패의 감각",
  "돌봄과 공동체",
  "기억과 상실",
  "예술과 창작",
  "디자인과 사용자의 마음",
  "언어와 침묵",
  "민주주의와 갈등",
  "혐오와 공감",
  "시간과 성장",
  "자본주의와 욕망",
]

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
- 각 항목은 보통 2~3개의 짧은 문장 또는 호흡으로 구성합니다.
- 2문장도 허용하지만, 갑자기 끊긴 느낌이 나면 안 됩니다. 전제, 비틀기, 여운이 자연스럽게 닫힐 때만 2문장으로 끝냅니다.
- 4문장은 거의 쓰지 말고, 생각의 층이 꼭 하나 더 필요할 때만 씁니다.
- 길이는 지금보다 한 호흡 짧게 씁니다. 선명한 문장 하나가 느슨한 설명 두 문장보다 낫습니다.
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
- 짧은 주제에 참고 내용이 제공된 경우, 반드시 그 검색 결과에서 확인되는 실제 정보와 맥락을 기반으로 요약과 질문을 만듭니다.
- 사용자 입력 원문에 있는 주제어를 잃지 말고, 참고 내용이 검색 결과일 때는 검색 결과의 잡음이나 광고성 문구를 핵심으로 삼지 않습니다.
- 검색 결과 중 사용자 원문과 직접 관련이 낮은 결과는 사용하지 않습니다. 결과 여러 개가 서로 다르면 공통으로 확인되는 내용과 가장 직접적인 결과를 우선합니다.
- 짧은 주제가 web_search나 검색 기반 참고 내용으로 보강된 경우, 실존 인물, 사건, 작품, 브랜드, 단체, 장소, 수치, 시기 같은 사실성 주제는 반드시 확인된 내용만 사용합니다.
- 실존 인물이나 팀, 작품, 브랜드처럼 사실 확인이 필요한 짧은 주제는 먼저 대상을 식별하고, 소속/직업/작품명/입단·출간·출시처럼 안정적으로 확인되는 사실을 우선합니다.
- 타율, OPS, 순위, 가격, 팔로워 수처럼 자주 바뀌는 수치나 "전 부문 선두", "최고", "확정" 같은 강한 평가는 사용자가 명시적으로 요구한 경우가 아니면 요약의 핵심으로 삼지 않습니다.
- 변동 수치가 꼭 필요할 때도 검색 결과 간 차이가 있으면 정확한 숫자 대신 "최근 성적", "검색 시점 기준", "상위권"처럼 보수적으로 표현합니다.
- 검색 결과로 확인되지 않은 사실은 요약에 쓰지 않습니다. 대신 확인된 범위, 불확실성, 생각해볼 쟁점을 중심으로 작성합니다.
- 검색 기반 참고 내용이 많은 경우에도 사실을 길게 나열하지 않습니다. 입력어를 이해하는 데 필요한 확인된 사실 2~3개와 그 사실들이 만드는 긴장만 남깁니다.
- 검색 기반 질문은 미래 예측, 추가 검색, 정답 확인을 요구하지 않습니다. 확인된 사실을 바탕으로 사용자의 관점과 판단 기준을 묻습니다.
- web_search 도구나 검색 기반 참고 내용 없이 제공된 짧은 주제는 개념형 주제로 간주합니다. 이 경우 실존 인물, 사건, 작품 배경, 저자, 연도, 소속, 수치 같은 사실을 절대 덧붙이지 말고 입력어 자체가 품은 관점과 긴장만 다룹니다.
- web_search 도구가 제공된 경우에는 검색 결과를 이 요청의 참고 내용으로 간주하고, 사용자 원문과 직접 관련된 상위 결과 1~3개에서 확인되는 범위만 실제 정보로 사용합니다.
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

const GEMINI_ROUTER_PROMPT = `당신은 Qraft의 초고속 라우터입니다.
입력 주제를 보고 어떤 처리 경로가 맞는지만 판단합니다. 질문, 요약, 설명은 생성하지 않습니다.

route 기준:
- abstract_topic: 철학, 감정, 관계, 사회 현상, 기술의 의미, 자아, 예술, 삶의 태도처럼 외부 사실보다 사유가 중심인 주제
- factual_topic: 실존 인물, 작품, 기업, 브랜드, 제품, 장소, 사건처럼 실제 정보 확인이 필요한 주제
- current_fact: 최근, 오늘, 올해, 가격, 순위, 정책, 뉴스, 변동성 있는 사실이 중요한 주제
- external_reference: 사용자가 정보, 추천, 비교, 출처, 검색, 누구인지 등을 요구하는 주제
- unclear: 확신이 낮은 주제

판단 규칙:
- "물리적 공간의 상실", "AI 시대의 인간성"처럼 개념 수식어가 붙은 주제는 실존 대상이 아니라 abstract_topic입니다.
- "참을 수 없는 존재의 가벼움"처럼 문학 작품명, 영화명, 책 제목으로 널리 알려진 고유 제목이 단독으로 들어오면 factual_topic입니다.
- 같은 문구라도 사용자가 관계, 상실, 인간성, 의미, 태도처럼 개념적 화두로 확장해 입력한 경우에는 abstract_topic입니다.
- 특정 사람/회사/영화/책/제품/장소의 실제 정보가 핵심이면 factual_topic입니다.
- 최신성이나 외부 확인이 핵심이면 current_fact 또는 external_reference입니다.
- 반드시 JSON 객체 하나만 반환합니다.
- JSON 형식: {"route":"abstract_topic|factual_topic|current_fact|external_reference|unclear","needs_grounding":true,"confidence":0.0,"rationale":"짧은 이유"}`

type QuestionRequest = {
  sourceOrigin?: unknown
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

type QuestionGenerationEventPayload = {
  cacheHit?: boolean
  errorCode?: string | null
  factGroundingStatus?: string | null
  factProvider?: string | null
  generationSuccess: boolean
  latencyMs: number
  mode: "generate" | "regenerate"
  previousQuestionCount: number
  questionCount?: number | null
  reflectionCount?: number | null
  request: Request
  sourceKind: SourceKind | "summary"
  sourceText?: string | null
  topicGroundingDecision?: TopicGroundingDecision | null
  useWebSearch?: boolean | null
}

type QuestionCachePayload = {
  expiresAt: string
  factGroundingStatus?: string | null
  factProvider?: string | null
  reflections: string[]
  routerReason?: string | null
  questions: string[]
  sourceKey: string
  sourceKind: Exclude<SourceKind, "text">
  sourceText: string
  summary: string
  useWebSearch?: boolean | null
}

type QuestionCacheRecord = {
  fact_grounding_status?: unknown
  fact_provider?: unknown
  questions?: unknown
  reflections?: unknown
  router_reason?: unknown
  summary?: unknown
  use_web_search?: unknown
}

type QuestionCacheHit = {
  factGroundingStatus: string | null
  factProvider: string | null
  questions: string[]
  reflections: string[]
  routerReason: string | null
  summary: string
  useWebSearch: boolean | null
}

type QuestionRateLimitEntry = {
  count: number
  resetAt: number
}

const questionRateLimitStore = new Map<string, QuestionRateLimitEntry>()

function isUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = request.headers.get("x-real-ip")?.trim()
  const cfConnectingIp = request.headers.get("cf-connecting-ip")?.trim()

  return forwardedFor || realIp || cfConnectingIp || "unknown"
}

function pruneQuestionRateLimitStore(now: number) {
  for (const [key, entry] of questionRateLimitStore) {
    if (entry.resetAt <= now) {
      questionRateLimitStore.delete(key)
    }
  }

  if (questionRateLimitStore.size <= questionRateLimitMaxEntries) {
    return
  }

  for (const key of questionRateLimitStore.keys()) {
    questionRateLimitStore.delete(key)

    if (questionRateLimitStore.size <= questionRateLimitMaxEntries / 2) {
      break
    }
  }
}

function checkQuestionRateLimit(request: Request) {
  const now = Date.now()
  const key = `ip:${getClientIp(request)}`

  pruneQuestionRateLimitStore(now)

  const currentEntry = questionRateLimitStore.get(key)

  if (!currentEntry || currentEntry.resetAt <= now) {
    questionRateLimitStore.set(key, {
      count: 1,
      resetAt: now + questionRateLimitWindowMs,
    })

    return { allowed: true, retryAfterSeconds: 0 }
  }

  if (currentEntry.count >= questionRateLimitMaxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((currentEntry.resetAt - now) / 1000)),
    }
  }

  currentEntry.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}

function questionRateLimitResponse(retryAfterSeconds: number) {
  return Response.json(
    {
      message: "질문 요청이 잠시 많아졌습니다. 잠시 후 다시 시도해 주세요.",
      code: "QUESTION_RATE_LIMITED",
      retryable: true,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    }
  )
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

function getYouTubeVideoId(source: string) {
  try {
    const url = new URL(source)
    const hostname = url.hostname.replace(/^www\./, "")

    if (hostname === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? ""
    }

    if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v")?.trim() ?? ""
      }

      const [, route, id] = url.pathname.split("/")

      if (route === "shorts" || route === "embed" || route === "live") {
        return id?.trim() ?? ""
      }
    }
  } catch {}

  return ""
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

function buildUngroundedTopicFallback(source: string) {
  const topic = source.trim()
  const subject = topic ? `"${topic}"` : "이 주제"

  return {
    summary: [
      `${subject}에 대해 확인되지 않은 사실을 단정하지 않고, 먼저 무엇을 알아야 하는지부터 분리합니다.`,
      "지금 다룰 수 있는 것은 확정된 설명이 아니라, 사실 확인과 해석 사이의 경계입니다.",
      "좋은 질문은 성급한 결론보다 어떤 근거가 필요한지 드러내는 데서 시작됩니다.",
      "",
      "1. 쟁점: 이 주제에서 사실과 인상을 어떻게 구분할 수 있을까요?",
      "2. 변화: 추가 정보가 확인되면 판단의 방향은 어떻게 달라질 수 있을까요?",
      "3. 생각할 점: 모르는 것을 인정하면서도 사유를 멈추지 않는 태도는 무엇일까요?",
    ].join("\n"),
    questions: [
      `${subject}에 대해 먼저 확인해야 할 사실과 아직 해석으로 남겨야 할 부분은 어떻게 나눌 수 있을까요?`,
      `${subject}를 둘러싼 판단이 성급해지지 않으려면 어떤 근거가 가장 먼저 필요할까요?`,
      `${subject}를 모른다고 말하는 순간에도 계속 생각해볼 수 있는 질문은 무엇일까요?`,
    ],
    reflections: [
      "정보가 부족한 상태에서 가장 위험한 것은 빈칸을 그럴듯한 이야기로 채우는 일일지도 모릅니다. 모르는 부분을 남겨두는 태도는 답을 미루는 것이 아니라, 생각의 바닥을 무너지지 않게 하는 방식처럼 보입니다.",
      "근거가 먼저인지 판단이 먼저인지에 따라 같은 주제도 전혀 다르게 보입니다. 빠른 확신은 편하지만, 때로는 가장 중요한 질문을 지나치게 만들기도 합니다.",
      "모른다는 말은 사유의 실패가 아니라 출발점일 수 있습니다. 지금 필요한 것은 결론을 꾸미는 일이 아니라, 어떤 사실을 확인해야 이 주제가 제대로 보이는지 묻는 일일지도 모릅니다.",
    ],
  }
}

function normalizeSummary(summary: string) {
  const lines = summary
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      if (/^\d+\.\s/.test(line) || line.length < 90) return [line]

      const sentences =
        line
          .match(/[^.!?。！？]+[.!?。！？]+(?=\s|$)|[^.!?。！？]+$/g)
          ?.map((sentence) => sentence.trim())
          .filter(Boolean) ?? []

      return sentences.length > 1 ? sentences : [line]
    })
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

function getResponseText(content: Array<{ type: string; text?: string }>) {
  return content
    .filter((block): block is { type: "text"; text: string } => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim()
}

function parseJsonFromText(raw: string): unknown {
  const jsonMatch = raw.match(/\{[\s\S]*\}/) ?? raw.match(/\[[\s\S]*\]/)
  return JSON.parse(jsonMatch ? jsonMatch[0] : raw)
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

  return sentences.slice(0, 4).join(" ").replace(/\s+/g, " ").trim()
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
type TopicGroundingReason =
  | "empty"
  | "numbers_or_dates"
  | "latin_entity"
  | "factual_keyword"
  | "external_reference"
  | "named_work_marker"
  | "mixed_entity_signal"
  | "example_topic"
  | "gemini_router_abstract"
  | "gemini_router_current_fact"
  | "gemini_router_external_reference"
  | "gemini_router_factual"
  | "short_or_single_name"
  | "spaced_name_or_title"
  | "semantic_factual_prototype"
  | "semantic_abstract_prototype"
  | "abstract_latin_concept"
  | "abstract_concept"
  | "concept"

type TopicGroundingDecision = {
  reason: TopicGroundingReason
  semanticScoreAbstract: number | null
  semanticScoreFactual: number | null
  useWebSearch: boolean
}

type GeminiRouterRoute = "abstract_topic" | "factual_topic" | "current_fact" | "external_reference" | "unclear"

type GeminiRouterDecision = {
  confidence: number
  needsGrounding: boolean
  route: GeminiRouterRoute
}

function getSourceKind(source: string): SourceKind {
  if (isYouTubeUrl(source)) return "youtube"
  if (isUrl(source)) return "url"
  return source.length < 100 ? "topic" : "text"
}

function normalizeRouterText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim()
}

function getCharacterNgrams(value: string, size = 2) {
  const normalized = normalizeRouterText(value)
  const ngrams = new Set<string>()

  if (!normalized) return ngrams
  if (normalized.length <= size) {
    ngrams.add(normalized)
    return ngrams
  }

  for (let index = 0; index <= normalized.length - size; index += 1) {
    ngrams.add(normalized.slice(index, index + size))
  }

  return ngrams
}

function getRouterTextSimilarity(input: string, prototype: string) {
  const normalizedInput = normalizeRouterText(input)
  const normalizedPrototype = normalizeRouterText(prototype)

  if (!normalizedInput || !normalizedPrototype) return 0
  if (normalizedInput === normalizedPrototype) return 1

  const inputNgrams = getCharacterNgrams(normalizedInput)
  const prototypeNgrams = getCharacterNgrams(normalizedPrototype)

  if (inputNgrams.size === 0 || prototypeNgrams.size === 0) return 0

  let intersectionSize = 0
  inputNgrams.forEach((ngram) => {
    if (prototypeNgrams.has(ngram)) {
      intersectionSize += 1
    }
  })

  const unionSize = inputNgrams.size + prototypeNgrams.size - intersectionSize
  const jaccardScore = unionSize > 0 ? intersectionSize / unionSize : 0
  const containmentScore =
    normalizedInput.includes(normalizedPrototype) || normalizedPrototype.includes(normalizedInput)
      ? Math.min(0.58, normalizedInput.length / Math.max(normalizedPrototype.length, 1))
      : 0

  return Math.max(jaccardScore, containmentScore)
}

function getRouterPrototypeScore(input: string, prototypes: string[]) {
  const scores = prototypes
    .map((prototype) => getRouterTextSimilarity(input, prototype))
    .sort((a, b) => b - a)

  return (scores[0] ?? 0) + (scores[1] ?? 0) * 0.25
}

function getSemanticRouterDecision(input: string) {
  const factualScore = getRouterPrototypeScore(input, factualRouterPrototypes)
  const abstractScore = getRouterPrototypeScore(input, abstractRouterPrototypes)

  if (abstractScore >= 0.34 && abstractScore >= factualScore + 0.07) {
    return { kind: "abstract" as const, score: abstractScore, factualScore, abstractScore }
  }
  if (factualScore >= 0.38 && factualScore >= abstractScore + 0.09) {
    return { kind: "factual" as const, score: factualScore, factualScore, abstractScore }
  }

  return { kind: null, score: Math.max(factualScore, abstractScore), factualScore, abstractScore }
}

function getExampleTopicGroundingDecision(source: string): TopicGroundingDecision {
  const semanticDecision = getSemanticRouterDecision(source)

  return {
    reason: "example_topic",
    semanticScoreAbstract: Number(semanticDecision.abstractScore.toFixed(4)),
    semanticScoreFactual: Number(semanticDecision.factualScore.toFixed(4)),
    useWebSearch: false,
  }
}

function mergeRouterDecision(
  localDecision: TopicGroundingDecision,
  decision: Pick<TopicGroundingDecision, "reason" | "useWebSearch">
): TopicGroundingDecision {
  return {
    ...decision,
    semanticScoreAbstract: localDecision.semanticScoreAbstract,
    semanticScoreFactual: localDecision.semanticScoreFactual,
  }
}

// Keep this deterministic. A model-based classifier would add another slow call before generation.
function getTopicGroundingDecision(source: string): TopicGroundingDecision {
  const raw = source.trim()
  const value = raw.toLowerCase()
  const compactValue = value.replace(/\s+/g, "")
  const words = value.split(/\s+/).filter(Boolean)
  const firstWord = words[0] ?? ""
  const conceptLeadWords = [
    "개념적",
    "개인",
    "개인적",
    "ai",
    "공적",
    "기술적",
    "나쁜",
    "나의",
    "디지털",
    "문화적",
    "물리적",
    "사적",
    "사회",
    "사회적",
    "심리적",
    "어떤",
    "온라인",
    "오프라인",
    "우리",
    "윤리적",
    "인간",
    "인공지능",
    "정서적",
    "정치적",
    "좋은",
    "철학적",
    "현대",
    "현대적",
  ]
  const hasAbstractSignal = abstractTopicKeywords.some((keyword) => value.includes(keyword))
  const hasFactualKeyword = factualTopicKeywords.some((keyword) => value.includes(keyword))
  const hasExternalReferenceKeyword = externalReferenceKeywords.some((keyword) => value.includes(keyword))
  const hasAbstractLatinSignal =
    abstractLatinTopics.includes(compactValue) || words.some((word) => abstractLatinTopics.includes(word))
  const hasTemporalOrNumericSignal =
    /\d/.test(value) ||
    /(?:오늘|어제|내일|올해|작년|내년|최근|요즘|현재|지금|최신|상반기|하반기|분기|월|일|년|시즌)/.test(value)
  const hasSpecificLatinName =
    /[a-z]{3,}/.test(value) &&
    !hasAbstractLatinSignal &&
    (/[A-Z]{2,}/.test(raw) || /[a-z]+[-_.]?[a-z0-9]+/i.test(raw) || words.length <= 4)
  const hasNamedWorkMarker = /["'“”‘’《》〈〉「」『』]/.test(raw)
  const hasKnownStandaloneWorkTitle = knownStandaloneWorkTitles.some((title) => compactValue === title.replace(/\s+/g, "").toLowerCase())
  const hasLikelyStandaloneWorkTitle =
    words.length >= 3 &&
    words.length <= 8 &&
    !conceptLeadWords.includes(firstWord) &&
    !["의미", "상실", "관계", "감정", "철학", "인간성", "정체성"].some((ending) => value.endsWith(ending)) &&
    /(?:\b수\b|없는|있는|그리고|에게|으로|처럼|의)/.test(value)
  const hasMixedEntitySignal = /[가-힣][a-z0-9]|[a-z0-9][가-힣]/i.test(value)
  const hasEntityWithConcept =
    words.length >= 2 &&
    words.length <= 5 &&
    /^[가-힣]{2,6}$/.test(firstWord) &&
    !abstractTopicKeywords.includes(firstWord) &&
    !conceptLeadWords.includes(firstWord) &&
    !/(?:은|는|을|를|한|적|적인|로운)$/.test(firstWord) &&
    hasAbstractSignal
  const semanticDecision = getSemanticRouterDecision(value)
  const hasLikelyHangulName = /^[가-힣]{2,6}$/.test(value) && !hasAbstractSignal
  const hasLikelySpacedName =
    /^[가-힣a-z\s·.-]{3,40}$/.test(value) &&
    value.split(/\s+/).filter(Boolean).length >= 2 &&
    !hasAbstractSignal &&
    !hasAbstractLatinSignal &&
    !/(?:와|과|의|을|를|이|가|은|는|에서|으로|하다|되다|적인)$/.test(value)
  const withSemanticScores = (
    decision: Pick<TopicGroundingDecision, "reason" | "useWebSearch">
  ): TopicGroundingDecision => ({
    ...decision,
    semanticScoreAbstract: Number(semanticDecision.abstractScore.toFixed(4)),
    semanticScoreFactual: Number(semanticDecision.factualScore.toFixed(4)),
  })

  if (!value) return withSemanticScores({ reason: "empty", useWebSearch: false })
  if (hasTemporalOrNumericSignal) return withSemanticScores({ reason: "numbers_or_dates", useWebSearch: true })
  if (hasExternalReferenceKeyword) return withSemanticScores({ reason: "external_reference", useWebSearch: true })
  if (hasNamedWorkMarker) return withSemanticScores({ reason: "named_work_marker", useWebSearch: true })
  if (hasKnownStandaloneWorkTitle || hasLikelyStandaloneWorkTitle) {
    return withSemanticScores({ reason: "named_work_marker", useWebSearch: true })
  }
  if (hasMixedEntitySignal) return withSemanticScores({ reason: "mixed_entity_signal", useWebSearch: true })
  if (hasSpecificLatinName) return withSemanticScores({ reason: "latin_entity", useWebSearch: true })
  if (hasEntityWithConcept) return withSemanticScores({ reason: "spaced_name_or_title", useWebSearch: true })
  if (semanticDecision.kind === "abstract") {
    return withSemanticScores({ reason: "semantic_abstract_prototype", useWebSearch: false })
  }
  if (semanticDecision.kind === "factual") {
    return withSemanticScores({ reason: "semantic_factual_prototype", useWebSearch: true })
  }
  if (hasAbstractSignal && hasFactualKeyword) return withSemanticScores({ reason: "abstract_concept", useWebSearch: false })
  if (hasFactualKeyword) return withSemanticScores({ reason: "factual_keyword", useWebSearch: true })
  if (hasLikelyHangulName) return withSemanticScores({ reason: "short_or_single_name", useWebSearch: true })
  if (hasLikelySpacedName) return withSemanticScores({ reason: "spaced_name_or_title", useWebSearch: true })
  if (hasAbstractLatinSignal) return withSemanticScores({ reason: "abstract_latin_concept", useWebSearch: false })
  if (hasAbstractSignal) return withSemanticScores({ reason: "abstract_concept", useWebSearch: false })

  return withSemanticScores({ reason: "concept", useWebSearch: false })
}

function shouldUseGeminiRouter(source: string, localDecision: TopicGroundingDecision) {
  const value = source.trim()

  if (!value || value.length >= 80) return false

  return [
    "abstract_concept",
    "concept",
    "semantic_abstract_prototype",
    "semantic_factual_prototype",
  ].includes(localDecision.reason)
}

function normalizeGeminiRouterDecision(parsed: unknown): GeminiRouterDecision | null {
  if (!parsed || typeof parsed !== "object") return null

  const payload = parsed as Record<string, unknown>
  const route = typeof payload.route === "string" ? payload.route : ""
  const confidence =
    typeof payload.confidence === "number" && Number.isFinite(payload.confidence)
      ? Math.max(0, Math.min(1, payload.confidence))
      : 0
  const needsGrounding = typeof payload.needs_grounding === "boolean" ? payload.needs_grounding : null

  if (
    route !== "abstract_topic" &&
    route !== "factual_topic" &&
    route !== "current_fact" &&
    route !== "external_reference" &&
    route !== "unclear"
  ) {
    return null
  }

  return {
    confidence,
    needsGrounding: needsGrounding ?? route !== "abstract_topic",
    route,
  }
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

function getGeminiApiKey() {
  return process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim() || ""
}

function getGeminiRouterModel() {
  return process.env.GEMINI_ROUTER_MODEL?.trim() || "gemini-2.5-flash-lite"
}

function getGeminiText(payload: unknown) {
  if (!payload || typeof payload !== "object") return ""

  const response = payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: unknown }> } }> }

  return (response.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim()
}

async function fetchGeminiRouterDecision(source: string): Promise<GeminiRouterDecision | null> {
  const apiKey = getGeminiApiKey()

  if (!apiKey) return null

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${getGeminiRouterModel()}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: [GEMINI_ROUTER_PROMPT, `사용자 입력:\n${source}`].join("\n\n"),
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: geminiRouterMaxTokens,
          responseMimeType: "application/json",
          temperature: 0,
        },
      }),
      signal: AbortSignal.timeout(geminiRouterTimeoutMs),
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini router request failed: ${response.status}`)
  }

  const raw = getGeminiText(await response.json())
  const parsed = parseJsonFromText(raw)

  return normalizeGeminiRouterDecision(parsed)
}

async function resolveTopicGroundingDecision(source: string) {
  const localDecision = getTopicGroundingDecision(source)

  if (!shouldUseGeminiRouter(source, localDecision)) {
    return localDecision
  }

  try {
    const routerDecision = await fetchGeminiRouterDecision(source)

    if (!routerDecision || routerDecision.confidence < 0.68 || routerDecision.route === "unclear") {
      return localDecision
    }

    if (routerDecision.route === "abstract_topic" && !routerDecision.needsGrounding) {
      return mergeRouterDecision(localDecision, {
        reason: "gemini_router_abstract",
        useWebSearch: false,
      })
    }

    if (routerDecision.route === "current_fact") {
      return mergeRouterDecision(localDecision, {
        reason: "gemini_router_current_fact",
        useWebSearch: true,
      })
    }

    if (routerDecision.route === "external_reference") {
      return mergeRouterDecision(localDecision, {
        reason: "gemini_router_external_reference",
        useWebSearch: true,
      })
    }

    if (routerDecision.route === "factual_topic" || routerDecision.needsGrounding) {
      return mergeRouterDecision(localDecision, {
        reason: "gemini_router_factual",
        useWebSearch: true,
      })
    }
  } catch (error) {
    console.error("Qraft Gemini router failed", error)
  }

  return localDecision
}

function buildModelInput({
  source,
  content,
  sourceKind,
  resolved,
  forceWebSearch,
}: {
  source: string
  content: string
  sourceKind: SourceKind
  resolved: boolean
  forceWebSearch?: boolean
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
      ? forceWebSearch
        ? [
            "참고 내용: 웹 검색 도구를 반드시 사용하세요.",
            "사용자 원문과 직접 관련된 상위 결과 1~3개만 참고하세요.",
            "검색 결과로 대상 식별이 가능하면 안정적으로 확인되는 사실 2~3개와 그 사실이 만드는 긴장을 바탕으로 요약과 질문을 만드세요.",
            "자주 바뀌는 수치, 순위, 가격, 성적은 사용자가 직접 요구하지 않았다면 정확한 숫자로 단정하지 말고 보수적으로 표현하세요.",
            "검색 결과로 확인되지 않은 이력, 소속, 기록, 수치, 평가를 추가하지 마세요.",
            "summary는 기본 형식을 유지하고, questions/reflections까지 반드시 완성된 JSON 객체 하나만 반환하세요.",
            "마크다운 코드블록, 인사말, 설명 문장은 절대 쓰지 마세요.",
          ].join(" ")
        : "참고 내용: 개념형 주제입니다. 실존 인물, 사건, 작품 배경, 저자, 연도, 소속, 수치 같은 사실을 덧붙이지 말고 입력어 자체가 품은 관점과 긴장만 다루세요."
      : "참고 내용: 충분히 확보되지 않았습니다. 사용자 원문에서 확인할 수 있는 범위를 넘어서 단정하지 마세요."

  return [
    `입력 유형: ${sourceLabel}`,
    `사용자 원문:\n${source}`,
    resolved && usableContent && usableContent !== source
      ? `${sourceKind === "topic" ? "검색 기반 참고 내용" : "참고 내용"}:\n${usableContent}`
      : contentGuide,
  ].join("\n\n")
}

function getInitialGenerationModel(sourceKind: SourceKind, forceWebSearch: boolean) {
  if (forceWebSearch || sourceKind === "url" || sourceKind === "youtube") {
    return sonnetGenerationModel
  }

  return fastGenerationModel
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

function getQuestionGenerationEventSourceText(sourceText?: string | null) {
  const trimmed = sourceText?.trim() ?? ""

  return trimmed ? trimmed.slice(0, 2000) : null
}

function normalizeUrlForCache(source: string) {
  try {
    const url = new URL(source)
    const filteredParams = [...url.searchParams.entries()]
      .filter(([key]) => {
        const normalizedKey = key.toLowerCase()

        return (
          !normalizedKey.startsWith("utm_") &&
          !["fbclid", "gclid", "igshid", "mc_cid", "mc_eid", "si"].includes(normalizedKey)
        )
      })
      .sort(([a], [b]) => a.localeCompare(b))
    const query = new URLSearchParams(filteredParams).toString()
    const pathname = url.pathname.replace(/\/+$/, "") || "/"

    return `${url.protocol}//${url.hostname.toLowerCase()}${pathname}${query ? `?${query}` : ""}`
  } catch {
    return null
  }
}

function normalizeSourceForCache(source: string, sourceKind: SourceKind) {
  if (sourceKind === "text") return null

  if (sourceKind === "topic") {
    return source.trim().replace(/\s+/g, " ").toLowerCase()
  }

  if (sourceKind === "youtube") {
    const videoId = getYouTubeVideoId(source)

    if (videoId) {
      return `youtube:${videoId}`
    }
  }

  return normalizeUrlForCache(source)
}

function getQuestionCacheSourceKey(source: string, sourceKind: SourceKind) {
  const normalizedSource = normalizeSourceForCache(source, sourceKind)

  if (!normalizedSource) return null

  return createHash("sha256").update(`${questionCacheVersion}:${sourceKind}:${normalizedSource}`).digest("hex")
}

function hasFreshnessSignal(source: string) {
  return /(?:오늘|어제|내일|올해|작년|내년|최근|요즘|현재|지금|최신|상반기|하반기|분기|\d{4}|월|일|년|시즌)/.test(
    source.toLowerCase()
  )
}

function getQuestionCacheExpiresAt(source: string, sourceKind: SourceKind, useWebSearch: boolean) {
  if (sourceKind === "text") return null

  const ttlMs =
    hasFreshnessSignal(source)
      ? cacheFreshnessTtlMs
      : sourceKind === "topic"
        ? useWebSearch
          ? cacheFactualTopicTtlMs
          : cacheTopicTtlMs
        : cacheLinkTtlMs

  return new Date(Date.now() + ttlMs).toISOString()
}

function normalizeCacheStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 3)
    : []
}

function normalizeQuestionCacheRecord(record: unknown): QuestionCacheHit | null {
  if (!record || typeof record !== "object") return null

  const payload = record as QuestionCacheRecord
  const summary = typeof payload.summary === "string" ? payload.summary.trim() : ""
  const questions = normalizeCacheStringArray(payload.questions)
  const reflections = normalizeCacheStringArray(payload.reflections)

  if (!summary || questions.length === 0 || reflections.length === 0) return null

  return {
    factGroundingStatus:
      typeof payload.fact_grounding_status === "string" ? payload.fact_grounding_status : null,
    factProvider: typeof payload.fact_provider === "string" ? payload.fact_provider : null,
    questions,
    reflections,
    routerReason: typeof payload.router_reason === "string" ? payload.router_reason : null,
    summary,
    useWebSearch: typeof payload.use_web_search === "boolean" ? payload.use_web_search : null,
  }
}

async function getQuestionGenerationCache(sourceKey: string): Promise<QuestionCacheHit | null> {
  try {
    const { supabase } = await createRouteClient()
    const { data, error } = await supabase.rpc("get_question_generation_cache", {
      cache_source_key: sourceKey,
    })

    if (error) {
      console.error("Qraft question cache lookup failed", error)
      return null
    }

    const record = Array.isArray(data) ? data[0] : data

    return normalizeQuestionCacheRecord(record)
  } catch (error) {
    console.error("Qraft question cache lookup failed", error)
    return null
  }
}

async function saveQuestionGenerationCache({
  expiresAt,
  factGroundingStatus = null,
  factProvider = null,
  questions,
  reflections,
  routerReason = null,
  sourceKey,
  sourceKind,
  sourceText,
  summary,
  useWebSearch = null,
}: QuestionCachePayload) {
  try {
    const { supabase } = await createRouteClient()
    const { error } = await supabase.rpc("upsert_question_generation_cache", {
      cache_source_key: sourceKey,
      cache_source_text: sourceText.slice(0, 2000),
      cache_source_kind: sourceKind,
      cache_summary: summary,
      cache_questions: questions,
      cache_reflections: reflections,
      cache_expires_at: expiresAt,
      cache_router_reason: routerReason,
      cache_use_web_search: useWebSearch,
      cache_fact_provider: factProvider,
      cache_fact_grounding_status: factGroundingStatus,
    })

    if (error) {
      console.error("Qraft question cache save failed", error)
    }
  } catch (error) {
    console.error("Qraft question cache save failed", error)
  }
}

async function recordQuestionGenerationEvent({
  cacheHit = false,
  errorCode = null,
  factGroundingStatus = null,
  factProvider = null,
  generationSuccess,
  latencyMs,
  mode,
  previousQuestionCount,
  questionCount = null,
  reflectionCount = null,
  request,
  sourceKind,
  sourceText = null,
  topicGroundingDecision = null,
  useWebSearch = null,
}: QuestionGenerationEventPayload) {
  const normalizedSourceText = getQuestionGenerationEventSourceText(sourceText)
  const path = new URL(request.url).pathname
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null

  try {
    const { supabase } = await createRouteClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    const { error } = await supabase.from("question_generation_events").insert({
      user_id: user?.id ?? null,
      mode,
      source_text: normalizedSourceText,
      source_length: sourceText?.trim().length ?? 0,
      source_kind: sourceKind,
      router_reason: topicGroundingDecision?.reason ?? null,
      use_web_search: useWebSearch,
      semantic_score_factual: topicGroundingDecision?.semanticScoreFactual ?? null,
      semantic_score_abstract: topicGroundingDecision?.semanticScoreAbstract ?? null,
      fact_provider: factProvider,
      fact_grounding_status: factGroundingStatus,
      cache_hit: cacheHit,
      generation_success: generationSuccess,
      latency_ms: Math.max(0, Math.round(latencyMs)),
      error_code: errorCode,
      question_count: questionCount,
      reflection_count: reflectionCount,
      previous_question_count: previousQuestionCount,
      page_path: path,
      user_agent: userAgent,
    })

    if (error) {
      console.error("Qraft question generation event insert failed", error)
    }
  } catch (eventError) {
    console.error("Qraft question generation event insert failed", eventError)
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
  const sourceOrigin = body.sourceOrigin === "example_topic" ? "example_topic" : null
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

  const requestStartedAt = Date.now()
  const getLatencyMs = () => Date.now() - requestStartedAt
  const rateLimit = checkQuestionRateLimit(request)

  if (!rateLimit.allowed) {
    return questionRateLimitResponse(rateLimit.retryAfterSeconds)
  }

  // 재생성 모드: 기존 요약으로 질문+고찰만 생성
  if (existingSummary) {
    let raw = ""
    const regenerateInput = buildRegenerateModelInput(existingSummary, previousQuestions)

    try {
      const response = await client.messages.create({
        model: sonnetGenerationModel,
        max_tokens: regenerationMaxTokens,
        temperature: 0.35,
        system: REGENERATE_SYSTEM_PROMPT,
        messages: [{ role: "user", content: regenerateInput }],
      })

      raw = getResponseText(response.content)
    } catch (error) {
      console.error(error)
      if (isTokenExhaustedError(error)) {
        await notifyTokenExhausted({ mode: "regenerate", sourceKind: "summary", request, error })
        await recordQuestionGenerationEvent({
          mode: "regenerate",
          sourceKind: "summary",
          sourceText: existingSummary,
          generationSuccess: false,
          latencyMs: getLatencyMs(),
          errorCode: TOKEN_EXHAUSTED_CODE,
          previousQuestionCount: previousQuestions.length,
          request,
        })
        return tokenExhaustedResponse()
      }

      await recordQuestionGenerationEvent({
        mode: "regenerate",
        sourceKind: "summary",
        sourceText: existingSummary,
        generationSuccess: false,
        latencyMs: getLatencyMs(),
        errorCode: "regenerate_model_error",
        questionCount: FALLBACK_QUESTIONS.length,
        reflectionCount: FALLBACK_REFLECTIONS.length,
        previousQuestionCount: previousQuestions.length,
        request,
      })

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
          model: sonnetGenerationModel,
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

        raw = getResponseText(response.content)
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

    await recordQuestionGenerationEvent({
      mode: "regenerate",
      sourceKind: "summary",
      sourceText: existingSummary,
      generationSuccess: true,
      latencyMs: getLatencyMs(),
      questionCount: questions.length,
      reflectionCount: reflections.length,
      previousQuestionCount: previousQuestions.length,
      request,
    })

    return Response.json({
      questions,
      reflections,
    })
  }

  // 최초 생성 모드
  let content: string
  let contentResolved = true
  const sourceKind = getSourceKind(source)
  const topicGroundingDecision =
    sourceKind === "topic"
      ? sourceOrigin === "example_topic"
        ? getExampleTopicGroundingDecision(source)
        : await resolveTopicGroundingDecision(source)
      : null
  const forceTopicWebSearch = topicGroundingDecision?.useWebSearch ?? false
  const cacheSourceKey = getQuestionCacheSourceKey(source, sourceKind)
  const cacheExpiresAt = getQuestionCacheExpiresAt(source, sourceKind, forceTopicWebSearch)
  let factProvider: "claude_web_search" | null = null
  let factGroundingStatus: "partial" | null = null

  if (cacheSourceKey && cacheExpiresAt) {
    const cachedResult = await getQuestionGenerationCache(cacheSourceKey)

    if (cachedResult) {
      await recordQuestionGenerationEvent({
        mode: "generate",
        sourceKind,
        sourceText: source,
        topicGroundingDecision,
        useWebSearch: cachedResult.useWebSearch ?? forceTopicWebSearch,
        factProvider: cachedResult.factProvider,
        factGroundingStatus: cachedResult.factGroundingStatus,
        generationSuccess: true,
        cacheHit: true,
        latencyMs: getLatencyMs(),
        questionCount: cachedResult.questions.length,
        reflectionCount: cachedResult.reflections.length,
        previousQuestionCount: previousQuestions.length,
        request,
      })

      return Response.json({
        summary: cachedResult.summary,
        questions: cachedResult.questions,
        reflections: cachedResult.reflections,
        cacheHit: true,
      })
    }
  }

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
    await recordQuestionGenerationEvent({
      mode: "generate",
      sourceKind,
      sourceText: source,
      topicGroundingDecision,
      useWebSearch: forceTopicWebSearch,
      generationSuccess: false,
      latencyMs: getLatencyMs(),
      errorCode: "link_parse_failed",
      previousQuestionCount: previousQuestions.length,
      request,
    })
    return linkParseFailureResponse()
  }

  if (forceTopicWebSearch) {
    factProvider = "claude_web_search"
    factGroundingStatus = "partial"
  }

  const modelInput = buildModelInput({
    source,
    content,
    sourceKind,
    resolved: contentResolved && content.trim().length > 0,
    forceWebSearch: forceTopicWebSearch,
  })

  let raw = ""

  try {
    const response = await client.messages.create({
      model: getInitialGenerationModel(sourceKind, forceTopicWebSearch),
      max_tokens: forceTopicWebSearch ? groundedGenerationMaxTokens : generationMaxTokens,
      temperature: forceTopicWebSearch ? 0.25 : 0.35,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: modelInput }],
      ...(forceTopicWebSearch
        ? {
            tools: [
              {
                type: "web_search_20250305" as const,
                name: "web_search" as const,
                max_uses: topicWebSearchMaxUses,
              },
            ],
            tool_choice: { type: "tool" as const, name: "web_search" },
          }
        : {}),
    })

    raw = getResponseText(response.content)
  } catch (error) {
    console.error(error)
    if (isTokenExhaustedError(error)) {
      await notifyTokenExhausted({ mode: "generate", sourceKind, request, error })
      await recordQuestionGenerationEvent({
        mode: "generate",
        sourceKind,
        sourceText: source,
        topicGroundingDecision,
        useWebSearch: forceTopicWebSearch,
        factProvider,
        factGroundingStatus,
        generationSuccess: false,
        latencyMs: getLatencyMs(),
        errorCode: TOKEN_EXHAUSTED_CODE,
        previousQuestionCount: previousQuestions.length,
        request,
      })
      return tokenExhaustedResponse()
    }

    if (sourceKind === "topic") {
      await recordQuestionGenerationEvent({
        mode: "generate",
        sourceKind,
        sourceText: source,
        topicGroundingDecision,
        useWebSearch: forceTopicWebSearch,
        factProvider,
        factGroundingStatus,
        generationSuccess: false,
        latencyMs: getLatencyMs(),
        errorCode: "generate_model_error",
        previousQuestionCount: previousQuestions.length,
        request,
      })
      return Response.json(buildUngroundedTopicFallback(source))
    }

    await recordQuestionGenerationEvent({
      mode: "generate",
      sourceKind,
      sourceText: source,
      topicGroundingDecision,
      useWebSearch: forceTopicWebSearch,
      factProvider,
      factGroundingStatus,
      generationSuccess: false,
      latencyMs: getLatencyMs(),
      errorCode: "generate_model_error",
      questionCount: FALLBACK_QUESTIONS.length,
      reflectionCount: FALLBACK_REFLECTIONS.length,
      previousQuestionCount: previousQuestions.length,
      request,
    })

    return Response.json({
      summary: FALLBACK_SUMMARY,
      questions: FALLBACK_QUESTIONS,
      reflections: FALLBACK_REFLECTIONS,
    })
  }

  let summary = FALLBACK_SUMMARY
  let questions: string[] = FALLBACK_QUESTIONS
  let reflections: string[] = FALLBACK_REFLECTIONS
  let hasCompleteModelPayload = false

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

      hasCompleteModelPayload =
        typeof payload.summary === "string" &&
        payload.summary.trim().length > 0 &&
        Array.isArray(payload.questions) &&
        payload.questions.length > 0 &&
        payload.questions.every((q) => typeof q === "string") &&
        Array.isArray(payload.reflections) &&
        payload.reflections.length > 0 &&
        payload.reflections.every((reflection) => typeof reflection === "string")
    }
  } catch {}

  if (forceTopicWebSearch && !hasCompleteModelPayload) {
    console.error("Qraft grounded topic response was incomplete", {
      reason: topicGroundingDecision?.reason,
      source,
      raw: raw.slice(0, 500),
    })

    await recordQuestionGenerationEvent({
      mode: "generate",
      sourceKind,
      sourceText: source,
      topicGroundingDecision,
      useWebSearch: forceTopicWebSearch,
      factProvider,
      factGroundingStatus,
      generationSuccess: false,
      latencyMs: getLatencyMs(),
      errorCode: "grounded_response_incomplete",
      previousQuestionCount: previousQuestions.length,
      request,
    })

    return Response.json(buildUngroundedTopicFallback(source))
  }

  questions = normalizeList(questions, FALLBACK_QUESTIONS)
  reflections = normalizeReflections(reflections, FALLBACK_REFLECTIONS)
  summary = normalizeSummary(removeUnavailableDisclosure(summary))

  if (cacheSourceKey && cacheExpiresAt && sourceKind !== "text") {
    await saveQuestionGenerationCache({
      expiresAt: cacheExpiresAt,
      factGroundingStatus,
      factProvider,
      questions,
      reflections,
      routerReason: topicGroundingDecision?.reason ?? null,
      sourceKey: cacheSourceKey,
      sourceKind,
      sourceText: source,
      summary,
      useWebSearch: forceTopicWebSearch,
    })
  }

  await recordQuestionGenerationEvent({
    mode: "generate",
    sourceKind,
    sourceText: source,
    topicGroundingDecision,
    useWebSearch: forceTopicWebSearch,
    factProvider,
    factGroundingStatus,
    generationSuccess: true,
    latencyMs: getLatencyMs(),
    questionCount: questions.length,
    reflectionCount: reflections.length,
    previousQuestionCount: previousQuestions.length,
    request,
  })

  return Response.json({ summary, questions, reflections, cacheHit: false })
}
