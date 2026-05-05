"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react"
import { MeshGradient } from "@paper-design/shaders-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/context/AuthContext"
import { useBgm } from "@/context/BgmContext"
import { gtag } from "@/lib/gtag"
import { logClientError } from "@/lib/client-error"
import { normalizeQuestionEndingTone, normalizeQuestionListTone } from "@/lib/question-tone"
import { usePerformanceMode } from "@/lib/use-performance-mode"

const desert = {
  background: "#120b07",
  ember: "#8d4f31",
  sand: "#efd3a2",
}

const silentRecordColors = ["#071613", "#123027", "#526f57", "#d8c3a4"]
const processRecordColors = ["#150906", "#3a160b", "#a24f25", "#ffd28a"]

const loadingMessages = [
  "텍스트의 뼈대를 추리고 있습니다.",
  "이면에 숨겨진 질문을 직조하는 중입니다.",
  "이제, 당신의 사유를 마주할 시간입니다.",
]

const structureDots = [
  { x: "-112px", y: "-76px", delay: "0ms" },
  { x: "96px", y: "-88px", delay: "120ms" },
  { x: "-82px", y: "68px", delay: "240ms" },
  { x: "118px", y: "64px", delay: "360ms" },
  { x: "-18px", y: "-118px", delay: "480ms" },
  { x: "10px", y: "70px", delay: "600ms" },
  { x: "-128px", y: "6px", delay: "720ms" },
  { x: "130px", y: "-8px", delay: "840ms" },
  { x: "-72px", y: "70px", delay: "900ms" },
  { x: "-92px", y: "-12px", delay: "960ms" },
  { x: "82px", y: "18px", delay: "1080ms" },
  { x: "74px", y: "-124px", delay: "1140ms" },
  { x: "-46px", y: "-102px", delay: "1200ms" },
  { x: "58px", y: "68px", delay: "1320ms" },
  { x: "-138px", y: "70px", delay: "1380ms" },
  { x: "-118px", y: "52px", delay: "1440ms" },
  { x: "108px", y: "-54px", delay: "1560ms" },
  { x: "-4px", y: "-82px", delay: "1680ms" },
  { x: "2px", y: "70px", delay: "1800ms" },
]

const phaseCards = [
  {
    phase: "Phase 01.",
    title: "투영",
    label: "Projection",
    tone: "qraft-phase-card-01",
    copy: "당신의 관심을 끄는 링크나 단어를 놓아둡니다. 그것은 사유의 설계도가 됩니다.",
  },
  {
    phase: "Phase 02.",
    title: "균열",
    label: "The Glitch",
    tone: "qraft-phase-card-02",
    copy: "질문 엔진이 텍스트의 이면을 파고듭니다. 당연함이 깨지는 지점에서 생각은 시작됩니다.",
  },
  {
    phase: "Phase 03.",
    title: "퇴적",
    label: "Sedimentation",
    tone: "qraft-phase-card-03",
    copy: "방대한 콘텐츠는 정제된 요약으로 응축되고, 그 아래 질문이 놓입니다. 때때로 타인이 남긴 사유의 흔적을 엿보며, 당신의 관점은 더욱 단단하게 층을 이룹니다.",
  },
]

const landingTitle = "Qraft"
const landingCopy = "답이 아니라 질문이 사람을 깊게 만듭니다"
const midnightInsightCopy = "모두가 잠든 시간, 당신의 생각만이 가득합니다"
const exampleTopics = [
  "알고리즘과 주체성",
  "AI 시대의 인간성",
  "디지털 도파민과 침묵",
  "편집된 자아",
  "물리적 공간의 상실",
  "기억의 외주화",
  "데이터와 실존",
  "참을 수 없는 존재의 가벼움",
]
const exampleTopicRows = [exampleTopics.slice(0, 5), exampleTopics.slice(5)]
const exampleTopicDelayOrder = [0, 4, 1, 6, 3, 2, 7, 5]
const ownershipQuestionLines = [
  "당신은 정보를 '가진' 사람입니까,",
  "정보로 '변화'하는 사람입니까?",
]
const ownershipBody =
  "기록학자 김익한 교수는 독서의 본질이 '정보의 소유'가 아닌 '존재의 변화'에 있다고 말합니다. 우리는 매일 수많은 링크와 아티클을 수집하며 지적 포만감을 느끼지만, 멈춰서 사유하지 않는 정보는 결코 내 것이 되지 못한 채 쌓여갈 뿐입니다."
const ownershipQuote =
  "\"소유는 ‘내 밖에 쌓아 두는 것’입니다. 존재는 ‘내 안으로 들여 나의 일부로 만드는 것’이에요. 정리하면 ‘세상 만물을 내 밖에 두느냐, 내 안에 들이느냐’입니다.\""
const ownershipClosing =
  "Qraft는 이 철학을 바탕으로 설계되었습니다. 단순히 정보를 저장하는 관성을 잠시 멈추고, 텍스트와 대면하여 당신이라는 존재가 확장되는 사유의 순간을 제공합니다."
const silentRecordQuote =
  "좋은 질문은 정답이라는 종착지에 닿기 위한 수단이 아니라, 사유의 길을 잃지 않게 하는 등불에 가깝습니다. 우리가 타인의 고찰을 엿보는 이유는 정답을 베끼기 위함이 아니라, 서로 다른 시선이 부딪힐 때 발생하는 불꽃을 목격하기 위함입니다."
const silentRecordCharacterStepMs = 72
const silentRecordCommaPauseMs = 420
const silentRecordSentencePauseMs = 900
const silentRecordLoopPauseMs = 3000

const getSilentRecordCharacterTimings = () => {
  let delay = 0

  const characters = Array.from(silentRecordQuote).map((character) => {
    if (character === " ") {
      return { character, delay: null }
    }

    const timing = { character, delay }
    delay += silentRecordCharacterStepMs

    if (character === "," || character === "，") {
      delay += silentRecordCommaPauseMs
    }

    if (/[.!?]/.test(character)) {
      delay += silentRecordSentencePauseMs
    }

    return timing
  })

  return {
    characters,
    cycleMs: delay + silentRecordLoopPauseMs,
  }
}

const silentRecordCharacterTimings = getSilentRecordCharacterTimings()

const dustMotions = [
  { dx: "-22px", dy: "10px", scale: 0.988 },
  { dx: "18px", dy: "-9px", scale: 1.01 },
  { dx: "-13px", dy: "18px", scale: 0.992 },
  { dx: "24px", dy: "5px", scale: 1.008 },
  { dx: "-16px", dy: "-8px", scale: 0.994 },
  { dx: "9px", dy: "15px", scale: 1.006 },
]

const softDustMotions = [
  { dx: "-0.018em", dy: "0.014em", scale: 0.998 },
  { dx: "0.016em", dy: "-0.012em", scale: 1.003 },
  { dx: "0.006em", dy: "0.018em", scale: 0.999 },
  { dx: "-0.011em", dy: "-0.014em", scale: 1.002 },
  { dx: "0.021em", dy: "0.005em", scale: 0.999 },
  { dx: "-0.007em", dy: "0.008em", scale: 1.001 },
]

const getDustStyle = (index: number, baseDelay: number, step = 28, motions = dustMotions) => {
  const motion = motions[index % motions.length]

  return {
    "--delay": `${baseDelay + index * step}ms`,
    "--dx": motion.dx,
    "--dy": motion.dy,
    "--scale": motion.scale,
  } as CSSProperties
}

function LandingDustText({
  text,
  shouldAnimate,
  delay,
  step,
  decorative = false,
  variant = "title",
}: {
  text: string
  shouldAnimate: boolean
  delay: number
  step?: number
  decorative?: boolean
  variant?: "title" | "soft"
}) {
  const isSoft = variant === "soft"

  return (
    <span
      aria-hidden={decorative ? true : undefined}
      aria-label={!decorative && shouldAnimate ? text : undefined}
      className="qraft-landing-dust"
    >
      {shouldAnimate
        ? Array.from(text).map((character, index) =>
            character === " " ? (
              <span aria-hidden="true" className="qraft-landing-dust-space" key={`${character}-${index}`}>
                &nbsp;
              </span>
            ) : (
              <span
                aria-hidden="true"
                className={`qraft-landing-dust-grain ${isSoft ? "qraft-landing-dust-grain-soft" : ""}`}
                key={`${character}-${index}`}
                style={getDustStyle(index, delay, step, isSoft ? softDustMotions : dustMotions)}
              >
                {character}
              </span>
            )
          )
        : text}
    </span>
  )
}

type GenerationState = "idle" | "loading" | "ready" | "error"
type LandingIntroPhase = "waiting" | "playing" | "settled"
type FeedbackStatus = "idle" | "sending" | "sent" | "error"

type QuestionPayload = {
  cacheHit?: boolean
  summary: string
  questions: string[]
  reflections: string[]
}

type QuestionErrorPayload = {
  message?: string
  code?: string
  retryable?: boolean
}

type QuestionHistory = {
  id: string
  source: string
  summary: string
  questions: string[]
  reflections?: string[]
  generatedAt: string
}

type PendingSaveState = {
  source: string
  summary: string
  questions: string[]
  reflections: string[]
  questionIndex: number
}

type RestoredResultState = Omit<PendingSaveState, "questionIndex"> & {
  generatedQuestions?: string[]
}

const refiningDuration = 2600
const cachedRefiningDuration = 280
const refiningStepDuration = refiningDuration / 3
const finalRevealDuration = 0
const regenerateDuration = 650
const regenerateStepDuration = 420
const slowLoadingNoticeDelayMs = 13000
const slowLoadingNotice = "질문을 조금만 더 다듬고 있습니다."
const tokenExhaustedCode = "TOKEN_EXHAUSTED"
const tokenExhaustedMessage =
  "토큰이 다 떨어져서 질문을 생성할 수 없습니다. 금방 관리자의 사비를 들여 채워보도록하겠습니다.."
const tokenExhaustedNoticeDuration = 1800
const questionHistoryStorageKey = "qraft:question-history"
const pendingSaveStorageKey = "qraft:pending-save"
const currentResultStorageKey = "qraft:current-result"
const feedbackRatingOptions = [1, 2, 3, 4, 5] as const

const wait = (duration: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration)
  })

const createQuestionApiError = (payload: QuestionErrorPayload, fallbackMessage: string) => {
  const error = new Error(payload.message || fallbackMessage) as Error & { code?: string; retryable?: boolean }

  error.code = payload.code
  error.retryable = payload.retryable

  return error
}

const isTokenExhaustedClientError = (error: unknown) =>
  error instanceof Error && (error as Error & { code?: string }).code === tokenExhaustedCode

const fetchQuestionPayload = async <Payload,>(
  body: Record<string, unknown>,
  fallbackMessage: string
) => {
  const response = await fetch("/api/questions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as QuestionErrorPayload
    throw createQuestionApiError(payload, fallbackMessage)
  }

  return (await response.json()) as Payload
}

const navButtonClass =
  "flex h-10 w-10 items-center justify-center border border-[#d9ad73]/30 bg-[#f5dfbd]/[0.08] text-[#f5dfbd]/55 shadow-[0_10px_30px_rgba(13,8,5,0.32)] backdrop-blur-md transition-colors duration-500 hover:border-[#d9ad73]/55 hover:text-[#f5dfbd]/90 focus:outline-none focus-visible:border-[#d9ad73]/70"

const getProfileImageUrl = (user: ReturnType<typeof useAuth>["user"]) => {
  if (!user) return null

  const metadata = user.user_metadata
  const imageUrl =
    metadata.avatar_url ??
    metadata.picture ??
    metadata.profile_image_url ??
    metadata.provider_avatar_url

  return typeof imageUrl === "string" && imageUrl.length > 0 ? imageUrl : null
}

const getQuestionKey = (source: string, question: string) => `${source.trim()}::${question.trim()}`
const getQuestionMemoryKey = (question: string) =>
  question
    .replace(/[?？!！.,，。'"“”‘’()\[\]{}:;·…\s]/g, "")
    .toLowerCase()

const mergeQuestionMemory = (...questionGroups: string[][]) => {
  const seen = new Set<string>()
  const merged: string[] = []

  questionGroups.flat().forEach((question) => {
    const cleanedQuestion = question.trim()
    const memoryKey = getQuestionMemoryKey(cleanedQuestion)

    if (!cleanedQuestion || !memoryKey || seen.has(memoryKey)) return

    seen.add(memoryKey)
    merged.push(cleanedQuestion)
  })

  return merged.slice(-12)
}

const isUrlLike = (source: string) => {
  try {
    const url = new URL(source)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

const getSourceType = (source: string) => (isUrlLike(source) ? "url" : source.length < 100 ? "topic" : "text")

const getLengthBucket = (value: string) => {
  const length = Array.from(value.trim()).length

  if (length === 0) return "empty"
  if (length <= 20) return "1_20"
  if (length <= 80) return "21_80"
  if (length <= 300) return "81_300"
  if (length <= 1200) return "301_1200"
  return "1201_plus"
}

const getScopedStorageKey = (key: string, userId?: string) => `${key}:${userId ?? "guest"}`

const getDisplayName = (user: ReturnType<typeof useAuth>["user"]) => {
  if (!user) return ""

  const metadata = user.user_metadata
  const name = metadata.name ?? metadata.full_name ?? metadata.nickname ?? metadata.preferred_username

  if (typeof name === "string" && name.trim()) return name.trim()
  if (user.email) return user.email.split("@")[0]

  return "Profile"
}

const getInitialResultState = () => {
  if (typeof window === "undefined") return null

  const rawResult = window.sessionStorage.getItem(currentResultStorageKey)
  if (!rawResult) return null

  try {
    const result = JSON.parse(rawResult) as RestoredResultState

    if (
      !result.source ||
      !result.summary ||
      !Array.isArray(result.questions) ||
      !Array.isArray(result.reflections)
    ) {
      return null
    }

    return {
      ...result,
      questions: normalizeQuestionListTone(result.questions),
      generatedQuestions: normalizeQuestionListTone(result.generatedQuestions ?? result.questions),
    }
  } catch {
    return null
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)
const getViewportProgress = (start: number, end: number, value: number) => clamp((start - value) / (start - end), 0, 1)
const getSegmentProgress = (progress: number, start: number, end: number) => clamp((progress - start) / (end - start), 0, 1)
const getRevealOffset = (progress: number, distance = 28) => `${((1 - progress) * distance).toFixed(1)}px`
const formatSummaryForDisplay = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
const getSummaryDisplayLines = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)

export default function Hero() {
  const [generationState, setGenerationState] = useState<GenerationState>("idle")
  const [loadingStep, setLoadingStep] = useState(0)
  const [loadingNotice, setLoadingNotice] = useState("")
  const [summary, setSummary] = useState("")
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [summaryOverflowing, setSummaryOverflowing] = useState(false)
  const [questions, setQuestions] = useState<string[]>([])
  const [generatedQuestionMemory, setGeneratedQuestionMemory] = useState<string[]>([])
  const [reflections, setReflections] = useState<string[]>([])
  const [errorMessage, setErrorMessage] = useState("")
  const [openReflectionIndexes, setOpenReflectionIndexes] = useState<Set<number>>(() => new Set())
  const [lastSource, setLastSource] = useState("")
  const [savedQuestionKeys, setSavedQuestionKeys] = useState<Set<string>>(() => new Set())
  const [savedQuestionIds, setSavedQuestionIds] = useState<Map<string, string>>(() => new Map())
  const [saveErrorMessage, setSaveErrorMessage] = useState("")
  const [showLogin, setShowLogin] = useState(false)
  const [landingIntroPhase, setLandingIntroPhase] = useState<LandingIntroPhase>("waiting")
  const [isMidnightInsight, setIsMidnightInsight] = useState(false)
  const [silentSectionActive, setSilentSectionActive] = useState(false)
  const [silentQuoteActive, setSilentQuoteActive] = useState(false)
  const [processSectionActive, setProcessSectionActive] = useState(false)
  const [hideLandingScrollCue, setHideLandingScrollCue] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackRating, setFeedbackRating] = useState<number | null>(null)
  const [feedbackRatingPreview, setFeedbackRatingPreview] = useState<number | null>(null)
  const [feedbackText, setFeedbackText] = useState("")
  const [feedbackStatus, setFeedbackStatus] = useState<FeedbackStatus>("idle")
  const [feedbackErrorMessage, setFeedbackErrorMessage] = useState("")
  const summaryRef = useRef<HTMLParagraphElement>(null)
  const landingInputRef = useRef<HTMLInputElement>(null)
  const philosophySectionRef = useRef<HTMLElement>(null)
  const philosophyCardRef = useRef<HTMLDivElement>(null)
  const section3Ref = useRef<HTMLElement>(null)
  const silentSectionRef = useRef<HTMLElement>(null)
  const silentCharacterRefs = useRef<Array<HTMLSpanElement | null>>([])
  const ctaSectionRef = useRef<HTMLElement>(null)
  const feedbackWidgetRef = useRef<HTMLDivElement>(null)
  const landingStartedAtRef = useRef<number | null>(null)
  const landingVisitSentRef = useRef(false)
  const questionInputFocusSentRef = useRef(false)
  const landingSectionViewSentRef = useRef<Set<string>>(new Set())
  const pendingSaveRestoredRef = useRef(false)
  const processSectionActiveRef = useRef(false)
  const hideLandingScrollCueRef = useRef(false)
  const step1TimerRef = useRef<number | undefined>(undefined)
  const slowNoticeTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    landingStartedAtRef.current = window.performance.now()

    if (landingVisitSentRef.current) return

    landingVisitSentRef.current = gtag.landingVisit()
  }, [])

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const result = getInitialResultState()

      if (result) {
        setSummary(result.summary)
        setQuestions(result.questions)
        setGeneratedQuestionMemory(mergeQuestionMemory(result.generatedQuestions ?? [], result.questions))
        setReflections(result.reflections)
        setLastSource(result.source)
        setGenerationState("ready")
      }
    }, 0)

    return () => {
      window.clearTimeout(restoreTimer)
      window.clearTimeout(step1TimerRef.current)
      window.clearTimeout(slowNoticeTimerRef.current)
    }
  }, [])
  const supabase = useMemo(() => createClient(), [])
  const { user, signOut } = useAuth()
  const { bgmOn, toggleBgm } = useBgm()
  const {
    pageVisible,
    pauseCssMotion,
    reduceShaderLoad,
    renderShader,
  } = usePerformanceMode()
  const questionHistoryScopedKey = getScopedStorageKey(questionHistoryStorageKey, user?.id)
  const profileImageUrl = getProfileImageUrl(user)
  const profileName = getDisplayName(user)
  const profileInitial =
    user?.user_metadata.full_name?.charAt(0) ??
    user?.user_metadata.name?.charAt(0) ??
    user?.user_metadata.nickname?.charAt(0) ??
    user?.email?.charAt(0) ??
    "Q"

  const isLoading = generationState === "loading"
  const isReady = generationState === "ready"
  const isLanding = generationState === "idle"
  const shouldPlayLandingIntro = landingIntroPhase === "playing"
  const shouldHideLandingIntro = landingIntroPhase === "waiting"
  const isRevealing = isLoading && loadingStep === 2
  const isRefined = isLoading || isReady
  const baseSpeed = isRefined ? 0.25 : 0.5
  const speed = isMidnightInsight ? baseSpeed * 0.5 : baseSpeed
  const shaderSpeed = reduceShaderLoad ? speed * 0.38 : speed
  const renderLayeredShaders = renderShader && !reduceShaderLoad
  const backgroundTreatment = isReady
    ? "scale-[1.03] blur-[14px]"
    : isRevealing
      ? "scale-105 blur-[28px]"
      : isLoading
        ? "scale-[1.03] blur-[14px]"
        : "scale-100 blur-0"
  const landingDisplayCopy = isMidnightInsight ? midnightInsightCopy : landingCopy
  const displayedSummary = formatSummaryForDisplay(summary)
  const displayedSummaryLines = getSummaryDisplayLines(displayedSummary)

  const getLandingElapsedMs = () =>
    landingStartedAtRef.current === null
      ? undefined
      : Math.max(0, Math.round(window.performance.now() - landingStartedAtRef.current))

  const getExperienceSurface = () =>
    isReady ? "result" : isLoading ? "loading" : generationState === "error" ? "error" : "landing"

  const trackQuestionInputFocus = () => {
    if (questionInputFocusSentRef.current) return

    questionInputFocusSentRef.current = true
    gtag.questionInputFocus({
      elapsed_ms: getLandingElapsedMs(),
      signed_in: Boolean(user),
    })
  }

  const openLoginPrompt = (context: "nav" | "save_question") => {
    setFeedbackOpen(false)
    setShowLogin(true)
    gtag.loginPromptView({ context })
  }

  const handleBgmToggle = () => {
    gtag.bgmToggle({
      next_state: bgmOn ? "off" : "on",
      surface: getExperienceSurface(),
    })
    toggleBgm()
  }

  const startSlowLoadingNotice = () => {
    window.clearTimeout(slowNoticeTimerRef.current)
    slowNoticeTimerRef.current = window.setTimeout(() => {
      setLoadingNotice(slowLoadingNotice)
    }, slowLoadingNoticeDelayMs)
  }

  const clearSlowLoadingNotice = () => {
    window.clearTimeout(slowNoticeTimerRef.current)
    slowNoticeTimerRef.current = undefined
  }

  const resetToIdle = () => {
    window.sessionStorage.removeItem(currentResultStorageKey)
    setLandingIntroPhase("settled")
    setGenerationState("idle")
    setLoadingNotice("")
  }

  const scrollToQuestionInput = () => {
    gtag.landingCtaClick()
    window.scrollTo({ top: 0, behavior: "smooth" })
    window.setTimeout(() => landingInputRef.current?.focus(), 650)
  }

  useEffect(() => {
    const updateMidnightInsight = () => {
      const hour = new Date().getHours()

      setIsMidnightInsight(hour >= 0 && hour < 4)
    }

    updateMidnightInsight()
    const timer = window.setInterval(updateMidnightInsight, 60000)

    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual"
    }
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (!isLanding || landingIntroPhase !== "waiting") return

    const startTimer = window.setTimeout(() => {
      setLandingIntroPhase("playing")
    }, 120)
    const settleTimer = window.setTimeout(() => {
      setLandingIntroPhase("settled")
    }, 3800)

    return () => {
      window.clearTimeout(startTimer)
      window.clearTimeout(settleTimer)
    }
  }, [isLanding, landingIntroPhase])

  useEffect(() => {
    if (!isLanding || !("IntersectionObserver" in window)) return

    const sections = [
      { name: "philosophy", element: philosophySectionRef.current },
      { name: "process", element: section3Ref.current },
      { name: "silent_record", element: silentSectionRef.current },
      { name: "final_cta", element: ctaSectionRef.current },
    ].filter((section): section is { name: string; element: HTMLElement } => section.element !== null)

    if (sections.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const section = sections.find((item) => item.element === entry.target)

          if (!section || landingSectionViewSentRef.current.has(section.name)) return
          if (!entry.isIntersecting || entry.intersectionRatio < 0.28) return

          landingSectionViewSentRef.current.add(section.name)
          gtag.landingSectionView({
            section: section.name,
            elapsed_ms:
              landingStartedAtRef.current === null
                ? undefined
                : Math.max(0, Math.round(window.performance.now() - landingStartedAtRef.current)),
          })
        })
      },
      {
        rootMargin: "-12% 0px -22% 0px",
        threshold: [0, 0.28, 0.52],
      }
    )

    sections.forEach(({ element }) => observer.observe(element))

    return () => observer.disconnect()
  }, [isLanding])

  useEffect(() => {
    if (!isLanding || !pageVisible) return

    const section3 = section3Ref.current
    if (!section3) return

    let frameId: number | undefined
    let viewportHeight = window.innerHeight
    let sectionTop = 0
    let sectionHeight = 0

    const measureSection = () => {
      const rect = section3.getBoundingClientRect()

      viewportHeight = window.innerHeight
      sectionTop = rect.top + window.scrollY
      sectionHeight = rect.height
    }

    const updateProcessReveal = () => {
      frameId = undefined

      const sectionViewportTop = sectionTop - window.scrollY
      const sectionViewportBottom = sectionViewportTop + sectionHeight
      const sectionProgress = getViewportProgress(viewportHeight * 0.9, viewportHeight * 0.36, sectionViewportTop)
      const headerProgress = getSegmentProgress(sectionProgress, 0.08, 0.36)
      const cardStarts = [0.32, 0.5, 0.68]

      section3.style.setProperty("--process-header-progress", headerProgress.toFixed(3))
      section3.style.setProperty("--process-header-y", getRevealOffset(headerProgress, 54))

      cardStarts.forEach((start, index) => {
        const cardProgress = getSegmentProgress(sectionProgress, start, start + 0.3)

        section3.style.setProperty(`--process-card-${index + 1}-progress`, cardProgress.toFixed(3))
        section3.style.setProperty(`--process-card-${index + 1}-y`, getRevealOffset(cardProgress, 54))
      })

      const nextActive = sectionViewportTop < viewportHeight * 0.72 && sectionViewportBottom > viewportHeight * 0.24

      if (processSectionActiveRef.current !== nextActive) {
        processSectionActiveRef.current = nextActive
        setProcessSectionActive(nextActive)
      }
    }

    const queueProcessReveal = () => {
      if (frameId !== undefined) return
      frameId = window.requestAnimationFrame(updateProcessReveal)
    }

    const handleResize = () => {
      measureSection()
      queueProcessReveal()
    }
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            measureSection()
            queueProcessReveal()
          })

    measureSection()
    queueProcessReveal()
    resizeObserver?.observe(section3)
    window.addEventListener("scroll", queueProcessReveal, { passive: true })
    window.addEventListener("resize", handleResize)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener("scroll", queueProcessReveal)
      window.removeEventListener("resize", handleResize)

      if (frameId !== undefined) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [isLanding, pageVisible])

  useEffect(() => {
    if (!isLanding) return

    const silentSection = silentSectionRef.current
    if (!silentSection || !("IntersectionObserver" in window)) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextActive = entry.isIntersecting && entry.intersectionRatio > 0.16

        setSilentSectionActive((currentActive) => (currentActive === nextActive ? currentActive : nextActive))
      },
      {
        rootMargin: "-18% 0px -24% 0px",
        threshold: [0, 0.16, 0.38],
      }
    )

    observer.observe(silentSection)

    return () => observer.disconnect()
  }, [isLanding])

  useEffect(() => {
    if (!isLanding) return

    const silentSection = silentSectionRef.current
    if (!silentSection || !("IntersectionObserver" in window)) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const nextActive = entry.isIntersecting && entry.intersectionRatio > 0.62

        setSilentQuoteActive((currentActive) => (currentActive === nextActive ? currentActive : nextActive))
      },
      {
        rootMargin: "-10% 0px -10% 0px",
        threshold: [0, 0.62, 0.78],
      }
    )

    observer.observe(silentSection)

    return () => observer.disconnect()
  }, [isLanding])

  useEffect(() => {
    const clearSilentCharacterGlow = () => {
      silentCharacterRefs.current.forEach((element) => {
        element?.classList.remove("qraft-silent-character-glowing")
      })
    }

    if (!isLanding || !pageVisible || pauseCssMotion || !silentQuoteActive) {
      clearSilentCharacterGlow()
      return
    }

    let timeoutId: number | undefined
    let activeElements = new Set<HTMLSpanElement>()
    const startedAt = window.performance.now()
    const characters = silentRecordCharacterTimings.characters
    const cycleMs = silentRecordCharacterTimings.cycleMs
    const glowStartOffset = cycleMs * 0.012
    const glowDuration = cycleMs * 0.036
    const updateInterval = Math.max(48, Math.min(96, silentRecordCharacterStepMs))

    const isWithinGlowWindow = (elapsed: number, start: number, end: number) =>
      start <= end ? elapsed >= start && elapsed <= end : elapsed >= start || elapsed <= end

    const updateActiveCharacters = () => {
      const elapsed = (window.performance.now() - startedAt) % cycleMs
      const nextActiveElements = new Set<HTMLSpanElement>()

      characters.forEach(({ delay }, index) => {
        if (delay === null) return

        const glowStart = (delay + glowStartOffset) % cycleMs
        const glowEnd = (glowStart + glowDuration) % cycleMs

        if (!isWithinGlowWindow(elapsed, glowStart, glowEnd)) return

        const element = silentCharacterRefs.current[index]
        if (element) nextActiveElements.add(element)
      })

      activeElements.forEach((element) => {
        if (!nextActiveElements.has(element)) {
          element.classList.remove("qraft-silent-character-glowing")
        }
      })

      nextActiveElements.forEach((element) => {
        if (!activeElements.has(element)) {
          element.classList.add("qraft-silent-character-glowing")
        }
      })

      activeElements = nextActiveElements
      timeoutId = window.setTimeout(updateActiveCharacters, updateInterval)
    }

    updateActiveCharacters()

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId)
      }

      activeElements.forEach((element) => element.classList.remove("qraft-silent-character-glowing"))
    }
  }, [isLanding, pageVisible, pauseCssMotion, silentQuoteActive])


  useEffect(() => {
    if (!isLanding || !pageVisible) return

    const philosophySection = philosophySectionRef.current
    const philosophyCard = philosophyCardRef.current
    if (!philosophySection || !philosophyCard) return

    let frameId: number | undefined
    let viewportHeight = window.innerHeight
    let cardTop = 0
    let cardHeight = 0

    const measureCard = () => {
      const cardRect = philosophyCard.getBoundingClientRect()

      viewportHeight = window.innerHeight
      cardTop = cardRect.top + window.scrollY
      cardHeight = cardRect.height
    }

    const updateOwnershipShift = () => {
      frameId = undefined

      const cardViewportTop = cardTop - window.scrollY
      const cardCenter = cardViewportTop + cardHeight / 2
      const cardProgress = getViewportProgress(viewportHeight * 0.84, viewportHeight * 0.5, cardCenter)
      const changeProgress = getSegmentProgress(cardProgress, 0, 0.52)
      const bodyProgress = getSegmentProgress(cardProgress, 0.08, 0.58)
      const quoteProgress = getSegmentProgress(cardProgress, 0.48, 0.78)
      const closingProgress = getSegmentProgress(cardProgress, 0.7, 1)

      const nextHideLandingScrollCue = changeProgress >= 0.98

      if (hideLandingScrollCueRef.current !== nextHideLandingScrollCue) {
        hideLandingScrollCueRef.current = nextHideLandingScrollCue
        setHideLandingScrollCue(nextHideLandingScrollCue)
      }

      philosophySection.style.setProperty("--ownership-shift", changeProgress.toFixed(3))
      philosophySection.style.setProperty("--ownership-body-progress", bodyProgress.toFixed(3))
      philosophySection.style.setProperty("--ownership-body-y", getRevealOffset(bodyProgress))
      philosophySection.style.setProperty("--ownership-quote-progress", quoteProgress.toFixed(3))
      philosophySection.style.setProperty("--ownership-quote-y", getRevealOffset(quoteProgress, 24))
      philosophySection.style.setProperty("--ownership-closing-progress", closingProgress.toFixed(3))
      philosophySection.style.setProperty("--ownership-closing-y", getRevealOffset(closingProgress, 24))
    }

    const queueOwnershipShift = () => {
      if (frameId !== undefined) return
      frameId = window.requestAnimationFrame(updateOwnershipShift)
    }

    const handleResize = () => {
      measureCard()
      queueOwnershipShift()
    }
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(() => {
            measureCard()
            queueOwnershipShift()
          })

    measureCard()
    queueOwnershipShift()
    resizeObserver?.observe(philosophyCard)
    window.addEventListener("scroll", queueOwnershipShift, { passive: true })
    window.addEventListener("resize", handleResize)

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener("scroll", queueOwnershipShift)
      window.removeEventListener("resize", handleResize)

      if (frameId !== undefined) {
        window.cancelAnimationFrame(frameId)
      }
    }
  }, [isLanding, pageVisible])

  useEffect(() => {
    let cancelled = false

    const loadSavedQuestionKeys = async () => {
      if (user) {
        const { data, error } = await supabase
          .from("saved_questions")
          .select("id, source, question")

        if (cancelled) return

        if (error) {
          logClientError("hero.saved_questions.load", error)
          setSavedQuestionKeys(new Set())
          setSaveErrorMessage("저장한 질문 상태를 불러오지 못했습니다.")
          return
        }

        const questionIds = new Map<string, string>()

        ;(data ?? [])
          .filter(
            (item) =>
              typeof item.id === "string" &&
              typeof item.source === "string" &&
              typeof item.question === "string"
          )
          .forEach((item) => {
            questionIds.set(getQuestionKey(item.source, normalizeQuestionEndingTone(item.question)), item.id)
          })

        setSavedQuestionKeys(new Set(questionIds.keys()))
        setSavedQuestionIds(questionIds)
        setSaveErrorMessage("")
        return
      }

      await Promise.resolve()
      if (!cancelled) {
        setSavedQuestionKeys(new Set())
        setSavedQuestionIds(new Map())
        setSaveErrorMessage("")
      }
    }

    loadSavedQuestionKeys()

    return () => {
      cancelled = true
    }
  }, [supabase, user])


  useEffect(() => {
    if (!isReady || !lastSource || !summary || questions.length === 0) return

    window.sessionStorage.setItem(
      currentResultStorageKey,
      JSON.stringify({
        source: lastSource,
        summary,
        questions,
        generatedQuestions: generatedQuestionMemory,
        reflections,
      } satisfies RestoredResultState)
    )
  }, [generatedQuestionMemory, isReady, lastSource, questions, reflections, summary])

  useEffect(() => {
    const summaryElement = summaryRef.current
    if (!summaryElement || !displayedSummary) {
      setSummaryOverflowing(false)
      return
    }

    const lineHeight = Number.parseFloat(window.getComputedStyle(summaryElement).lineHeight)
    const collapsedHeight = lineHeight * 3

    setSummaryOverflowing(summaryElement.scrollHeight > collapsedHeight + 1)
  }, [displayedSummary, summaryExpanded, isReady])

  const generateQuestions = async (source: string) => {
    const isExampleTopic = exampleTopics.includes(source)

    gtag.questionGenerateRequest({
      signed_in: Boolean(user),
      source_type: getSourceType(source),
      source_origin: isExampleTopic ? "example_topic" : "manual",
      source_length_bucket: getLengthBucket(source),
      elapsed_ms: getLandingElapsedMs(),
    })
    setLoadingStep(0)
    setLoadingNotice("")
    setSummary("")
    setSummaryExpanded(false)
    setSummaryOverflowing(false)
    setQuestions([])
    setGeneratedQuestionMemory([])
    setReflections([])
    setErrorMessage("")
    setSaveErrorMessage("")
    setOpenReflectionIndexes(new Set())
    setLastSource(source)
    setGenerationState("loading")

    step1TimerRef.current = window.setTimeout(() => setLoadingStep(1), refiningStepDuration)
    startSlowLoadingNotice()

    try {
      const generationStartedAt = window.performance.now()
      const payloadPromise = fetchQuestionPayload<QuestionPayload>(
        { source, ...(isExampleTopic ? { sourceOrigin: "example_topic" } : {}) },
        "질문을 만들지 못했습니다. 잠시 후 다시 시도해 주세요."
      )

      const payload = await payloadPromise
      const normalizedPayload = {
        ...payload,
        questions: normalizeQuestionListTone(payload.questions),
      }
      const minimumDuration = normalizedPayload.cacheHit ? cachedRefiningDuration : refiningDuration
      const remainingDuration = Math.max(0, minimumDuration - (window.performance.now() - generationStartedAt))

      if (remainingDuration > 0) {
        await wait(remainingDuration)
      }

      window.clearTimeout(step1TimerRef.current)
      clearSlowLoadingNotice()
      setLoadingStep(2)
      await wait(finalRevealDuration)

      setSummary(normalizedPayload.summary)
      setQuestions(normalizedPayload.questions)
      setGeneratedQuestionMemory(mergeQuestionMemory(normalizedPayload.questions))
      setReflections(normalizedPayload.reflections)
      await saveHistory(source, normalizedPayload)
      setLoadingNotice("")
      setGenerationState("ready")
      gtag.questionGenerateSuccess({
        signed_in: Boolean(user),
        source_type: getSourceType(source),
        source_origin: isExampleTopic ? "example_topic" : "manual",
        source_length_bucket: getLengthBucket(source),
        cache_hit: Boolean(normalizedPayload.cacheHit),
        question_count: normalizedPayload.questions.length,
        reflection_count: normalizedPayload.reflections.length,
      })
    } catch (error) {
      window.clearTimeout(step1TimerRef.current)
      clearSlowLoadingNotice()
      logClientError("hero.questions.generate", error)
      const isTokenExhausted = isTokenExhaustedClientError(error)

      if (isTokenExhausted) {
        setLoadingStep(1)
        setLoadingNotice(tokenExhaustedMessage)
        gtag.tokenExhausted({ flow: "generate", signed_in: Boolean(user) })
        await wait(tokenExhaustedNoticeDuration)
      }

      setErrorMessage(
        isTokenExhausted
          ? tokenExhaustedMessage
          : error instanceof Error
            ? error.message
            : "사유의 흐름이 잠시 끊겼습니다. 다시 한번 텍스트를 직조합니다."
      )
      setGenerationState("error")
      gtag.questionGenerateFailure({
        signed_in: Boolean(user),
        source_type: getSourceType(source),
        source_origin: isExampleTopic ? "example_topic" : "manual",
        source_length_bucket: getLengthBucket(source),
      })
    }
  }

  const runRegenerate = async () => {
    if (!summary) return

    const previousQuestions = mergeQuestionMemory(generatedQuestionMemory, questions)
    gtag.questionRegenerateRequest()
    setLoadingStep(0)
    setLoadingNotice("")
    setQuestions([])
    setReflections([])
    setErrorMessage("")
    setSaveErrorMessage("")
    setOpenReflectionIndexes(new Set())
    setGenerationState("loading")

    step1TimerRef.current = window.setTimeout(() => setLoadingStep(1), regenerateStepDuration)
    startSlowLoadingNotice()

    try {
      const payloadPromise = fetchQuestionPayload<{ questions: string[]; reflections: string[] }>(
        { source: lastSource, summary, previousQuestions },
        "질문을 다시 만들지 못했습니다. 잠시 후 다시 시도해 주세요."
      )

      const [payload] = await Promise.all([payloadPromise, wait(regenerateDuration)])
      const normalizedQuestions = normalizeQuestionListTone(payload.questions)

      window.clearTimeout(step1TimerRef.current)
      clearSlowLoadingNotice()
      setLoadingStep(2)
      await wait(finalRevealDuration)

      setQuestions(normalizedQuestions)
      setGeneratedQuestionMemory((currentQuestions) =>
        mergeQuestionMemory(previousQuestions, currentQuestions, normalizedQuestions)
      )
      setReflections(payload.reflections)
      setLoadingNotice("")
      setGenerationState("ready")
      gtag.questionRegenerateSuccess({
        question_count: normalizedQuestions.length,
        reflection_count: payload.reflections.length,
      })
    } catch (error) {
      window.clearTimeout(step1TimerRef.current)
      clearSlowLoadingNotice()
      logClientError("hero.questions.regenerate", error)
      const isTokenExhausted = isTokenExhaustedClientError(error)

      if (isTokenExhausted) {
        setLoadingStep(1)
        setLoadingNotice(tokenExhaustedMessage)
        gtag.tokenExhausted({ flow: "regenerate" })
        await wait(tokenExhaustedNoticeDuration)
      }

      setErrorMessage(isTokenExhausted ? tokenExhaustedMessage : "질문을 다시 만들지 못했습니다. 잠시 후 다시 시도해 주세요.")
      setGenerationState("error")
      gtag.questionRegenerateFailure()
    }
  }

  const saveHistory = async (source: string, payload: QuestionPayload) => {
    if (user) {
      const { error } = await supabase.from("question_history").insert({
        user_id: user.id,
        source,
        summary: payload.summary,
        questions: payload.questions,
        reflections: payload.reflections,
      })

      if (error) {
        logClientError("hero.history.save", error)
      }

      return
    }

    let history: QuestionHistory[] = []
    const rawHistory = window.localStorage.getItem(questionHistoryScopedKey)

    if (rawHistory) {
      try {
        const parsed = JSON.parse(rawHistory)
        if (Array.isArray(parsed)) {
          history = parsed as QuestionHistory[]
        }
      } catch {}
    }

    const historyItem: QuestionHistory = {
      id: crypto.randomUUID(),
      source,
      summary: payload.summary,
      questions: payload.questions,
      reflections: payload.reflections,
      generatedAt: new Date().toISOString(),
    }

    window.localStorage.setItem(
      questionHistoryScopedKey,
      JSON.stringify([historyItem, ...history].slice(0, 50))
    )
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const source = String(formData.get("source") ?? "").trim()

    if (!source) return

    await generateQuestions(source)
  }

  const handleExampleTopic = (topic: string) => {
    gtag.exampleTopicSelect({
      topic_index: exampleTopics.indexOf(topic) + 1,
      elapsed_ms: getLandingElapsedMs(),
    })

    if (landingInputRef.current) {
      landingInputRef.current.value = topic
      landingInputRef.current.focus()
    }
  }

  const handleFeedbackToggle = () => {
    setFeedbackOpen((isOpen) => {
      const nextOpen = !isOpen

      if (nextOpen) {
        setShowLogin(false)
        gtag.feedbackOpen({
          surface: getExperienceSurface(),
          signed_in: Boolean(user),
        })
      }

      return nextOpen
    })
  }

  useEffect(() => {
    if (!feedbackOpen) return

    const handleOutsidePointerDown = (event: PointerEvent) => {
      const feedbackWidget = feedbackWidgetRef.current

      if (feedbackWidget && event.target instanceof Node && feedbackWidget.contains(event.target)) {
        return
      }

      setFeedbackOpen(false)
      if (feedbackStatus === "sent") {
        setFeedbackStatus("idle")
      }
    }

    window.addEventListener("pointerdown", handleOutsidePointerDown)

    return () => window.removeEventListener("pointerdown", handleOutsidePointerDown)
  }, [feedbackOpen, feedbackStatus])

  const handleFeedbackSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const message = feedbackText.trim()
    const hasRating = feedbackRating !== null

    if (feedbackStatus === "sending") {
      return
    }

    if (!hasRating && message.length === 0) {
      setFeedbackErrorMessage("별점 또는 코멘트를 남겨주세요.")
      setFeedbackStatus("error")
      return
    }

    if (message.length === 1) {
      setFeedbackErrorMessage("코멘트는 2자 이상 남겨주세요.")
      setFeedbackStatus("error")
      return
    }

    setFeedbackErrorMessage("")
    setFeedbackStatus("sending")

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message || null,
          rating: feedbackRating,
          pagePath: `${window.location.pathname}${window.location.search}`,
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { message?: string; code?: string }
        gtag.feedbackSubmitFailure({
          rating: feedbackRating,
          has_message: Boolean(message),
          message_length_bucket: getLengthBucket(message),
          error_code: payload.code ?? "unknown",
        })
        setFeedbackErrorMessage(payload.message ?? "지금은 기록하지 못했습니다. 잠시 후 다시 남겨주세요.")
        setFeedbackStatus("error")
        return
      }
    } catch (error) {
      logClientError("hero.feedback.submit", error)
      gtag.feedbackSubmitFailure({
        rating: feedbackRating,
        has_message: Boolean(message),
        message_length_bucket: getLengthBucket(message),
        error_code: "network_error",
      })
      setFeedbackErrorMessage("네트워크 연결을 확인한 뒤 다시 남겨주세요.")
      setFeedbackStatus("error")
      return
    }

    gtag.feedbackSubmitSuccess({
      rating: feedbackRating,
      has_message: Boolean(message),
      message_length_bucket: getLengthBucket(message),
    })
    setFeedbackText("")
    setFeedbackRating(null)
    setFeedbackStatus("sent")
  }

  const saveQuestion = async (
    question: string,
    questionIndex: number,
    overrideState?: Pick<PendingSaveState, "source" | "summary">
  ) => {
    const questionToSave = normalizeQuestionEndingTone(question)
    const sourceToSave = overrideState?.source ?? lastSource
    const summaryToSave = overrideState?.summary ?? summary
    const questionKey = getQuestionKey(sourceToSave, questionToSave)
    gtag.questionSaveIntent({ signed_in: Boolean(user), question_index: questionIndex })

    if (!user) {
      window.sessionStorage.setItem(
        pendingSaveStorageKey,
        JSON.stringify({
          source: lastSource,
          summary,
          questions,
          reflections,
          questionIndex,
        } satisfies PendingSaveState)
      )
      openLoginPrompt("save_question")
      return
    }

    if (savedQuestionKeys.has(questionKey)) {
      const savedQuestionId = savedQuestionIds.get(questionKey)
      const deleteQuery = supabase.from("saved_questions").delete()
      const { error } = savedQuestionId
        ? await deleteQuery.eq("id", savedQuestionId)
        : await deleteQuery.eq("source", sourceToSave).eq("question", questionToSave)

      if (error) {
        logClientError("hero.question.unsave", error)
        setSaveErrorMessage("저장 상태를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.")
        return
      }

      setSaveErrorMessage("")
      gtag.questionUnsave({ question_index: questionIndex })
      setSavedQuestionKeys((currentKeys) => {
        const nextKeys = new Set(currentKeys)
        nextKeys.delete(questionKey)
        return nextKeys
      })
      setSavedQuestionIds((currentIds) => {
        const nextIds = new Map(currentIds)
        nextIds.delete(questionKey)
        return nextIds
      })
      return
    }

    {
      const { data, error } = await supabase.from("saved_questions").insert({
        user_id: user.id,
        source: sourceToSave,
        summary: summaryToSave,
        question: questionToSave,
        question_index: questionIndex,
      }).select("id").single()

      if (error) {
        logClientError("hero.question.save", error)
        setSaveErrorMessage("질문을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.")
        return
      }

      setSaveErrorMessage("")
      gtag.questionSave({ question_index: questionIndex })
      setSavedQuestionKeys((currentKeys) => new Set(currentKeys).add(questionKey))
      if (data && typeof data.id === "string") {
        setSavedQuestionIds((currentIds) => new Map(currentIds).set(questionKey, data.id))
      }
      return
    }
  }

  useEffect(() => {
    if (!user || pendingSaveRestoredRef.current) return

    const rawPendingSave = window.sessionStorage.getItem(pendingSaveStorageKey)
    if (!rawPendingSave) return

    let timeout: number | undefined

    try {
      const pendingSave = JSON.parse(rawPendingSave) as PendingSaveState
      const pendingSaveQuestions = Array.isArray(pendingSave.questions)
        ? normalizeQuestionListTone(pendingSave.questions)
        : []
      const question = pendingSaveQuestions[pendingSave.questionIndex - 1]

      if (
        !pendingSave.source ||
        !pendingSave.summary ||
        pendingSaveQuestions.length === 0 ||
        !Array.isArray(pendingSave.reflections) ||
        !question
      ) {
        window.sessionStorage.removeItem(pendingSaveStorageKey)
        return
      }

      pendingSaveRestoredRef.current = true
      timeout = window.setTimeout(() => {
        setLastSource(pendingSave.source)
        setSummary(pendingSave.summary)
        setQuestions(pendingSaveQuestions)
        setGeneratedQuestionMemory(mergeQuestionMemory(pendingSaveQuestions))
        setReflections(pendingSave.reflections)
        setSummaryExpanded(false)
        setOpenReflectionIndexes(new Set())
        setGenerationState("ready")

        window.sessionStorage.removeItem(pendingSaveStorageKey)
        window.sessionStorage.setItem(
          currentResultStorageKey,
          JSON.stringify({
            source: pendingSave.source,
            summary: pendingSave.summary,
            questions: pendingSaveQuestions,
            generatedQuestions: pendingSaveQuestions,
            reflections: pendingSave.reflections,
          } satisfies RestoredResultState)
        )
        void (async () => {
          const questionKey = getQuestionKey(pendingSave.source, question)
          const [historyResponse, savedQuestionResponse] = await Promise.all([
            supabase.from("question_history").insert({
              user_id: user.id,
              source: pendingSave.source,
              summary: pendingSave.summary,
              questions: pendingSaveQuestions,
              reflections: pendingSave.reflections,
            }),
            supabase.from("saved_questions").insert({
              user_id: user.id,
              source: pendingSave.source,
              summary: pendingSave.summary,
              question,
              question_index: pendingSave.questionIndex,
            }).select("id").single(),
          ])

          if (historyResponse.error) {
            logClientError("hero.pending_save.history", historyResponse.error)
          }

          if (savedQuestionResponse.error) {
            logClientError("hero.pending_save.question", savedQuestionResponse.error)
            setSaveErrorMessage("로그인 후 질문 저장을 완료하지 못했습니다. 다시 저장해 주세요.")
            return
          }

          setSaveErrorMessage("")
          setSavedQuestionKeys((currentKeys) => new Set(currentKeys).add(questionKey))
          if (savedQuestionResponse.data && typeof savedQuestionResponse.data.id === "string") {
            setSavedQuestionIds((currentIds) =>
              new Map(currentIds).set(questionKey, savedQuestionResponse.data.id)
            )
          }
        })()
      }, 0)
    } catch {
      window.sessionStorage.removeItem(pendingSaveStorageKey)
    }

    return () => {
      if (timeout) window.clearTimeout(timeout)
    }
  }, [supabase, user])

  const toggleReflection = (index: number) => {
    const expanded = !openReflectionIndexes.has(index)

    gtag.resultReflectionToggle({
      expanded,
      question_index: index + 1,
    })

    setOpenReflectionIndexes((currentIndexes) => {
      const nextIndexes = new Set(currentIndexes)

      if (nextIndexes.has(index)) {
        nextIndexes.delete(index)
      } else {
        nextIndexes.add(index)
      }

      return nextIndexes
    })
  }

  const toggleSummaryExpanded = () => {
    const nextExpanded = !summaryExpanded

    gtag.resultSummaryToggle({
      expanded: nextExpanded,
      summary_length_bucket: getLengthBucket(summary),
    })

    setSummaryExpanded(nextExpanded)
  }

  return (
    <div
      className={
        `${isLanding
          ? "relative min-h-screen w-full overflow-x-hidden bg-[#120b07]"
          : "relative h-screen w-full overflow-hidden bg-[#120b07]"
        } ${pauseCssMotion ? "qraft-motion-rested" : ""}`
      }
    >
      {/* 우측 상단 로그인/로그아웃 */}
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        {user ? (
          <>
            <button
              type="button"
              onClick={signOut}
              className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#f5dfbd]/42 transition-colors duration-500 hover:text-[#f5dfbd]/80 focus:outline-none"
            >
              Logout
            </button>
            <Link
              href="/profile"
              className="flex h-10 max-w-48 items-center gap-2 rounded-full border border-[#d9ad73]/25 bg-[#f5dfbd]/[0.08] px-2.5 pr-3 text-left text-[#f5dfbd]/70 shadow-[0_10px_30px_rgba(13,8,5,0.32)] backdrop-blur-md transition-colors duration-500 hover:border-[#d9ad73]/55 hover:text-[#f5dfbd]/95 focus:outline-none"
            >
              <span className="flex h-[29px] w-[29px] shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d9ad73]/35 bg-[#f5dfbd]/10 font-mono text-[11px] font-semibold uppercase text-[#f5dfbd]/75">
                {profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  profileInitial
                )}
              </span>
              <span className="min-w-0 truncate font-mono text-xs font-medium uppercase tracking-[0.1em]">
                {profileName}
              </span>
            </Link>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              openLoginPrompt("nav")
            }}
            className="h-10 border border-[#d9ad73]/25 bg-[#f5dfbd]/[0.08] px-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#f5dfbd]/60 shadow-[0_10px_30px_rgba(13,8,5,0.32)] backdrop-blur-md transition-colors duration-500 hover:border-[#d9ad73]/55 hover:text-[#f5dfbd]/90 focus:outline-none"
          >
            Login
          </button>
        )}
      </div>

      {/* 로그인 모달 */}
      {showLogin && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowLogin(false)}
        >
          <div
            className="w-full max-w-xs border border-[#d9ad73]/25 bg-[#120b07]/90 p-8 shadow-[0_24px_80px_rgba(13,8,5,0.72)] backdrop-blur-xl"
            style={{ animation: "qraft-reveal 300ms ease-out forwards" }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-[10px] font-medium uppercase leading-none tracking-[0.18em] text-[#d2ad7c]/55">
              Sign in
            </p>
            <p className="mt-3 text-sm font-medium leading-[1.6] text-[#f5dfbd]/60"
              style={{ fontFamily: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' }}>
              질문 히스토리를 저장하시려면 로그인하세요
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <Link
                href="/auth/sign-in?provider=google&next=/"
                onClick={() => gtag.loginStart("google")}
                className="flex h-11 w-full items-center justify-center gap-3 border border-[#d9ad73]/30 bg-[#f5dfbd]/10 px-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#f5dfbd]/80 transition-colors duration-300 hover:border-[#d9ad73]/60 hover:bg-[#f5dfbd]/15 focus:outline-none"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </Link>

              <Link
                href="/auth/sign-in?provider=kakao&next=/"
                onClick={() => gtag.loginStart("kakao")}
                className="flex h-11 w-full items-center justify-center gap-3 border border-[#d9ad73]/30 bg-[#FEE500]/10 px-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#FEE500]/80 transition-colors duration-300 hover:border-[#FEE500]/40 hover:bg-[#FEE500]/15 focus:outline-none"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#FEE500" aria-hidden="true">
                  <path d="M12 3C7.03 3 3 6.36 3 10.5c0 2.62 1.7 4.93 4.27 6.28L6.2 20.1a.5.5 0 0 0 .72.55l4.08-2.7c.33.03.67.05 1 .05 4.97 0 9-3.36 9-7.5S16.97 3 12 3z"/>
                </svg>
                Continue with Kakao
              </Link>
            </div>

            <button
              type="button"
              onClick={() => setShowLogin(false)}
              className="mt-6 w-full font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#f5dfbd]/30 transition-colors duration-300 hover:text-[#f5dfbd]/55 focus:outline-none"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <div
        ref={feedbackWidgetRef}
        className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6"
        style={{ fontFamily: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
      >
        {feedbackOpen && (
          <div
            role="dialog"
            aria-modal="false"
            aria-labelledby="qraft-feedback-title"
            className="pointer-events-auto w-[calc(100vw-2rem)] max-w-[360px] border border-[#d9ad73]/24 bg-[#120b07]/86 p-5 text-left text-[#f5dfbd] shadow-[0_24px_80px_rgba(8,4,3,0.62)] backdrop-blur-xl"
            style={{ animation: "qraft-reveal 360ms ease-out forwards" }}
          >
            {feedbackStatus === "sent" ? (
              <div className="text-center">
                <p className="font-mono text-[9px] font-medium uppercase leading-none tracking-[0.2em] text-[#d2ad7c]/48">
                  Qraft Field Note
                </p>
                <h2
                  id="qraft-feedback-title"
                  className="mt-5 text-lg font-medium leading-[1.45] text-[#f5dfbd]/88 [word-break:keep-all]"
                >
                  의견 감사합니다.
                </h2>
                <p className="mx-auto mt-3 max-w-64 text-xs font-medium leading-[1.7] text-[#f5dfbd]/50 [word-break:keep-all]">
                  남겨주신 내용은 서비스 개선에 반영하겠습니다.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackOpen(false)
                    setFeedbackStatus("idle")
                  }}
                  className="mt-6 rounded-full border border-[#d9ad73]/28 bg-[#f5dfbd]/[0.08] px-5 py-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-[#f5dfbd]/68 transition-colors duration-300 hover:border-[#efd3a2]/56 hover:bg-[#f5dfbd]/[0.13] hover:text-[#fff4dc] focus:outline-none focus-visible:border-[#efd3a2]/70"
                >
                  닫기
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-[#d9ad73]/14 pb-4">
                  <div>
                    <p className="font-mono text-[9px] font-medium uppercase leading-none tracking-[0.2em] text-[#d2ad7c]/48">
                      Qraft Field Note
                    </p>
                    <h2
                      id="qraft-feedback-title"
                      className="mt-3 text-base font-medium leading-[1.45] text-[#f5dfbd]/84 [word-break:keep-all]"
                    >
                      서비스를 위해 말씀을 남겨주세요.
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFeedbackOpen(false)}
                    aria-label="코멘트 닫기"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d9ad73]/18 bg-[#f5dfbd]/[0.05] text-[#f5dfbd]/45 transition-colors duration-300 hover:border-[#d9ad73]/36 hover:text-[#f5dfbd]/80 focus:outline-none focus-visible:border-[#efd3a2]/65"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                      <path d="M3.5 3.5L10.5 10.5M10.5 3.5L3.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                <p className="mt-4 text-xs font-medium leading-[1.7] text-[#f5dfbd]/52 [word-break:keep-all]">
                  짧은 감상, 불편했던 순간, 더 발전했으면 하는 부분 알려주시면 개선에 참고하겠습니다.
                </p>

                <form onSubmit={handleFeedbackSubmit} className="mt-4">
                  <fieldset className="mb-4">
                    <legend className="mb-2 font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[#d2ad7c]/42">
                      Rating
                    </legend>
                    <div
                      className="flex items-center gap-1.5"
                      role="radiogroup"
                      aria-label="서비스 별점"
                      onPointerLeave={() => setFeedbackRatingPreview(null)}
                    >
                      {feedbackRatingOptions.map((rating) => {
                        const previewRating = feedbackRatingPreview ?? feedbackRating
                        const selected = previewRating !== null && rating <= previewRating
                        const previewed = feedbackRatingPreview !== null && rating <= feedbackRatingPreview

                        return (
                          <button
                            key={rating}
                            type="button"
                            role="radio"
                            aria-checked={feedbackRating === rating}
                            aria-label={`${rating}점`}
                            onFocus={() => setFeedbackRatingPreview(rating)}
                            onBlur={() => setFeedbackRatingPreview(null)}
                            onPointerEnter={() => setFeedbackRatingPreview(rating)}
                            onClick={() => {
                              setFeedbackRating(rating)
                              setFeedbackRatingPreview(null)
                              gtag.feedbackRatingSelect({
                                rating,
                                surface: getExperienceSurface(),
                              })
                              if (feedbackStatus !== "idle") {
                                setFeedbackStatus("idle")
                                setFeedbackErrorMessage("")
                              }
                            }}
                            className={`qraft-rating-star-button ${previewed ? "qraft-rating-star-button-preview" : ""} flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300 focus:outline-none focus-visible:border-[#efd3a2]/70 ${
                              selected
                                ? "border-[#efd3a2]/42 bg-[#f5dfbd]/[0.1] text-[#efd3a2]/88"
                                : "border-[#d9ad73]/16 bg-[#080403]/24 text-[#f5dfbd]/26 hover:border-[#d9ad73]/34 hover:text-[#f5dfbd]/54"
                            }`}
                            style={{ "--rating-star-delay": `${(rating - 1) * 34}ms` } as CSSProperties}
                          >
                            <svg
                              className="qraft-rating-star-icon"
                              width="17"
                              height="17"
                              viewBox="0 0 24 24"
                              fill={selected ? "currentColor" : "none"}
                              aria-hidden="true"
                            >
                              <path
                                d="M12 3.75L14.45 8.71L19.93 9.5L15.96 13.37L16.9 18.82L12 16.24L7.1 18.82L8.04 13.37L4.07 9.5L9.55 8.71L12 3.75Z"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.55"
                              />
                            </svg>
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>

                  <textarea
                    value={feedbackText}
                    onChange={(event) => {
                      setFeedbackText(event.target.value)
                      if (feedbackStatus !== "idle") {
                        setFeedbackStatus("idle")
                        setFeedbackErrorMessage("")
                      }
                    }}
                    maxLength={1200}
                    rows={5}
                    placeholder={"작성하신 내용은 관리자에게 전달됩니다.\n별점만 남겨주셔도 큰 힘이 됩니다."}
                    className="min-h-32 w-full resize-none border border-[#d9ad73]/20 bg-[#080403]/32 px-4 py-3 text-sm font-medium leading-[1.7] text-[#f5dfbd]/78 outline-none transition-colors duration-300 placeholder:text-[#d2ad7c]/34 focus:border-[#d9ad73]/48 focus:bg-[#080403]/44"
                  />

                  <div className="mt-3 flex items-center justify-between gap-4">
                    <span className="font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[#d2ad7c]/36">
                      {feedbackText.length}/1200
                    </span>
                    <button
                      type="submit"
                      disabled={
                        feedbackStatus === "sending" ||
                        (feedbackRating === null && feedbackText.trim().length === 0) ||
                        feedbackText.trim().length === 1
                      }
                      className="rounded-full border border-[#d9ad73]/28 bg-[#f5dfbd]/[0.08] px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-[#f5dfbd]/68 transition-colors duration-300 hover:border-[#efd3a2]/56 hover:bg-[#f5dfbd]/[0.13] hover:text-[#fff4dc] disabled:cursor-not-allowed disabled:border-[#d9ad73]/12 disabled:text-[#f5dfbd]/28"
                    >
                      {feedbackStatus === "sending" ? "기록 중" : "남기기"}
                    </button>
                  </div>

                  {feedbackStatus === "error" && (
                    <p className="mt-3 text-xs font-medium leading-[1.6] text-[#f0b58d]/78">
                      {feedbackErrorMessage || "지금은 기록하지 못했습니다. 잠시 후 다시 남겨주세요."}
                    </p>
                  )}
                </form>
              </>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={handleFeedbackToggle}
          aria-label="서비스 코멘트 남기기"
          aria-expanded={feedbackOpen}
          className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full border border-[#d9ad73]/26 bg-[#120b07]/58 text-[#f5dfbd]/68 shadow-[0_12px_36px_rgba(8,4,3,0.42)] backdrop-blur-xl transition-all duration-500 hover:border-[#efd3a2]/52 hover:bg-[#f5dfbd]/[0.1] hover:text-[#fff4dc] hover:shadow-[0_16px_48px_rgba(245,223,189,0.1)] focus:outline-none focus-visible:border-[#efd3a2]/72"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 18.85C15.78 18.85 18.85 15.78 18.85 12C18.85 8.22 15.78 5.15 12 5.15C8.22 5.15 5.15 8.22 5.15 12C5.15 15.78 8.22 18.85 12 18.85Z"
              stroke="currentColor"
              strokeWidth="1.75"
            />
            <path
              d="M15.9 15.95L19.25 19.25"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.9"
            />
          </svg>
        </button>
      </div>

      {/* 좌측 상단 네비게이션 */}
      <nav className="absolute left-4 top-4 z-20 flex items-center gap-1.5">
        <button
          type="button"
          onClick={resetToIdle}
          aria-label="홈으로"
          className={navButtonClass}
        >
          <svg width="19" height="19" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M1.5 6.5L6.5 2L11.5 6.5V11.5H8.5V8.5H4.5V11.5H1.5V6.5Z" fill="currentColor" />
          </svg>
        </button>

        <button
          type="button"
          onClick={handleBgmToggle}
          aria-label={bgmOn ? "BGM 끄기" : "BGM 켜기"}
          className={navButtonClass}
        >
          {bgmOn ? (
            <svg width="19" height="19" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M1.5 4.5H3.5L6.5 2.5V10.5L3.5 8.5H1.5V4.5Z" fill="currentColor" />
              <path d="M8.5 5C9 5.44 9.25 5.94 9.25 6.5C9.25 7.06 9 7.56 8.5 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
              <path d="M10 3.5C11.08 4.31 11.75 5.36 11.75 6.5C11.75 7.64 11.08 8.69 10 9.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="19" height="19" viewBox="0 0 13 13" fill="none" aria-hidden="true">
              <path d="M1.5 4.5H3.5L6.5 2.5V10.5L3.5 8.5H1.5V4.5Z" fill="currentColor" />
              <path d="M8.5 5L11 8M11 5L8.5 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          )}
        </button>
      </nav>

      {/* 배경 그라디언트 */}
      <div
        className={`${isLanding ? "fixed" : "absolute"} inset-0 transition-[filter,transform] duration-[1600ms] ease-in-out ${backgroundTreatment}`}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #120b07 0%, #1d100a 34%, #2a170e 62%, #8d4f31 100%)",
          }}
        />
        {renderShader && (
          <MeshGradient
            className="absolute inset-0 h-full w-full"
            colors={[desert.background, "#2a170e", desert.ember, desert.sand]}
            speed={shaderSpeed}
          />
        )}
        {renderLayeredShaders && (
          <MeshGradient
            className={`absolute inset-0 h-full w-full transition-opacity duration-[1500ms] ease-in-out ${
              isLanding && processSectionActive ? "opacity-80" : "opacity-0"
            }`}
            colors={processRecordColors}
            speed={isLanding && processSectionActive ? shaderSpeed * 0.92 : 0}
          />
        )}
        <div
          className={`absolute inset-0 bg-[#080403]/37 transition-opacity duration-[1500ms] ease-in-out ${
            isLanding && processSectionActive ? "opacity-100" : "opacity-0"
          }`}
        />
        {renderLayeredShaders && (
          <MeshGradient
            className={`absolute inset-0 h-full w-full transition-opacity duration-[1400ms] ease-in-out ${
              isLanding && silentSectionActive ? "opacity-100" : "opacity-0"
            }`}
            colors={silentRecordColors}
            speed={isLanding && silentSectionActive ? shaderSpeed * 0.85 : 0}
          />
        )}

        {!reduceShaderLoad && (
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute left-1/3 top-1/4 h-32 w-32 rounded-full bg-[#d8a66d]/10 blur-3xl animate-pulse"
              style={{ animationDuration: `${3 / speed}s` }}
            />
            <div
              className="absolute bottom-1/3 right-1/4 h-24 w-24 rounded-full bg-[#f1d3a2]/10 blur-2xl animate-pulse"
              style={{ animationDuration: `${2 / speed}s`, animationDelay: "1s" }}
            />
            <div
              className="absolute right-1/3 top-1/2 h-20 w-20 rounded-full bg-[#7d452b]/10 blur-xl animate-pulse"
              style={{ animationDuration: `${4 / speed}s`, animationDelay: "0.5s" }}
            />
          </div>
        )}
      </div>

      {/* 오버레이 */}
      <div
        className={`pointer-events-none ${isLanding ? "fixed" : "absolute"} inset-0 transition-colors duration-[1600ms] ease-in-out ${
          isReady
            ? "bg-[#120b07]/84"
            : isRevealing
              ? "bg-[#120b07]/68"
              : isLanding && isMidnightInsight
                  ? "bg-[#080403]/58"
                  : "bg-[#120b07]/35"
        }`}
      />

      {/* 메인 콘텐츠 */}
      <div
        className={
          isLanding
            ? "relative z-10 flex min-h-screen flex-col items-center text-center"
            : `pointer-events-none absolute inset-0 z-10 flex flex-col items-center px-6 text-center ${
                isReady ? "justify-start overflow-hidden py-20 sm:overflow-y-auto sm:py-24" : "justify-center"
              }`
        }
        style={{ fontFamily: '"Outfit", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
      >
        {generationState === "idle" && (
          <>
            <section className="relative flex min-h-svh w-full flex-col items-center justify-center px-6 pb-[12svh] pt-24 sm:min-h-screen sm:pb-[12vh]">
              <div className="flex w-full flex-col items-center">
                <h1
                  className={`relative text-5xl font-medium leading-[1.1] tracking-normal drop-shadow-[0_8px_28px_rgba(13,8,5,0.28)] sm:text-[64px] ${
                    shouldHideLandingIntro ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <span className="text-[#f5dfbd]/90 mix-blend-difference">
                    <LandingDustText delay={360} shouldAnimate={shouldPlayLandingIntro} step={58} text={landingTitle} />
                  </span>
                  <span aria-hidden="true" className="absolute inset-0 text-[#efd3a2] mix-blend-overlay">
                    <LandingDustText
                      decorative
                      delay={360}
                      shouldAnimate={shouldPlayLandingIntro}
                      step={58}
                      text={landingTitle}
                    />
                  </span>
                </h1>
                <p
                  className={`relative mt-3 max-w-2xl text-sm font-medium leading-[1.7] tracking-normal sm:text-lg ${
                    shouldHideLandingIntro ? "opacity-0" : "opacity-100"
                  }`}
                >
                  <span className="text-[#f5dfbd]/65 mix-blend-difference">
                    <LandingDustText
                      delay={780}
                      shouldAnimate={shouldPlayLandingIntro}
                      text={landingDisplayCopy}
                      variant="soft"
                    />
                  </span>
                  <span aria-hidden="true" className="absolute inset-0 text-[#efd3a2]/70 mix-blend-overlay">
                    <LandingDustText
                      decorative
                      delay={780}
                      shouldAnimate={shouldPlayLandingIntro}
                      text={landingDisplayCopy}
                      variant="soft"
                    />
                  </span>
                </p>

                <form
                  onSubmit={handleSubmit}
                  className={`${
                    shouldHideLandingIntro
                      ? "opacity-0"
                      : shouldPlayLandingIntro
                        ? "qraft-landing-form"
                        : "opacity-100"
                  } pointer-events-auto mt-[54px] flex w-full max-w-2xl flex-col gap-3 drop-shadow-[0_18px_44px_rgba(18,11,7,0.42)] sm:flex-row sm:items-end`}
                  style={{ fontFamily: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
                >
                  <label className="flex flex-1 flex-col gap-2 text-left">
                    <span className="relative font-mono text-[10px] font-medium uppercase leading-none tracking-[0.18em]">
                      <span className="text-[#f5dfbd]/70 mix-blend-difference">Link / Topic</span>
                      <span aria-hidden="true" className="absolute inset-0 text-[#efd3a2]/80 mix-blend-overlay">
                        Link / Topic
                      </span>
                    </span>
                    <input
                      ref={landingInputRef}
                      type="text"
                      name="source"
                      placeholder="링크 또는 주제를 입력해주세요"
                      onFocus={trackQuestionInputFocus}
                      className="h-12 rounded-none border border-[#d9ad73]/30 bg-[#f5dfbd]/[0.16] px-4 text-lg font-normal text-[#f5dfbd]/90 shadow-[0_10px_30px_rgba(13,8,5,0.32)] outline-none backdrop-blur-md transition-colors duration-700 placeholder:text-[#efd3a2]/70 focus:border-[#d9ad73]/55 focus:bg-[#f5dfbd]/[0.19] [&::placeholder]:text-sm"
                    />
                  </label>

                  <button
                    type="submit"
                    className="h-12 w-full border border-[#d9ad73]/40 bg-[#f5dfbd]/20 px-5 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[#f5dfbd]/85 shadow-[0_10px_30px_rgba(13,8,5,0.32)] backdrop-blur-md transition-colors duration-700 hover:border-[#efd3a2]/90 hover:bg-[#8d4f31]/35 hover:text-[#fff4dc] active:border-[#efd3a2] active:bg-[#8d4f31]/50 active:text-[#fff4dc] focus:outline-none focus-visible:border-[#efd3a2]/90 sm:w-24"
                  >
                    입력
                  </button>
                </form>

                <div
                  className={`${
                    shouldHideLandingIntro
                      ? "opacity-0"
                      : shouldPlayLandingIntro
                        ? "qraft-example-topics opacity-100"
                        : "opacity-100"
                  } pointer-events-auto mt-5 flex w-full max-w-3xl flex-col items-center gap-2.5`}
                  style={{ fontFamily: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
                >
                  {exampleTopicRows.map((topics, rowIndex) => (
                    <div
                      key={rowIndex}
                      className={`${rowIndex === 1 ? "hidden sm:flex" : "flex"} flex-wrap justify-center gap-2.5`}
                    >
                      {topics.map((topic, topicIndex) => {
                        const topicOrder = exampleTopicDelayOrder[rowIndex * 5 + topicIndex] ?? topicIndex
                        const delay = 3650 + topicOrder * 65

                        return (
                          <button
                            type="button"
                            key={topic}
                            onClick={() => handleExampleTopic(topic)}
                            className={`qraft-example-topic rounded-full border border-[#d9ad73]/20 bg-[#120b07]/24 px-4 py-2 text-[12px] font-medium leading-none text-[#f5dfbd]/60 shadow-[0_8px_24px_rgba(13,8,5,0.18)] backdrop-blur-md transition-colors duration-300 hover:border-[#d9ad73]/45 hover:bg-[#f5dfbd]/[0.09] hover:text-[#f5dfbd]/86 focus:outline-none focus-visible:border-[#efd3a2]/70 ${
                              shouldPlayLandingIntro ? "qraft-example-topic-arrive" : ""
                            }`}
                            style={{ "--topic-delay": `${delay}ms` } as CSSProperties}
                          >
                            {topic}
                          </button>
                        )
                      })}
                    </div>
                  ))}
                </div>

              </div>

              <div
                aria-hidden="true"
                className={`absolute bottom-[6.5vh] left-1/2 -translate-x-1/2 transition-opacity duration-700 ease-out ${
                  shouldHideLandingIntro || hideLandingScrollCue
                    ? "opacity-0"
                    : "opacity-100"
                }`}
              >
                <div className="qraft-scroll-cue-shell">
                  <div className="qraft-scroll-cue">
                    <svg width="24" height="24" viewBox="0 0 18 18" fill="none">
                      <path
                        d="M4.5 7.25L9 11.75L13.5 7.25"
                        stroke="currentColor"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </section>

            <section ref={philosophySectionRef} className="w-full px-6 pb-8 pt-12 text-left sm:pb-10 sm:pt-16">
              <div
                ref={philosophyCardRef}
                className="qraft-scroll-rise mx-auto w-full max-w-6xl border border-[#d9ad73]/25 bg-[#120b07]/70 p-6 shadow-[0_24px_80px_rgba(13,8,5,0.48)] backdrop-blur-xl sm:p-8"
              >
                <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:gap-14">
                  <div>
                    <p className="font-mono text-[10px] font-medium uppercase leading-none tracking-[0.2em] text-[#d2ad7c]/55">
                      02 / Philosophy
                    </p>
                    <div className="mt-6 h-px w-full bg-[#d9ad73]/16" />
                    <h2 className="mt-8 text-2xl font-medium leading-[1.22] tracking-normal [word-break:keep-all] sm:text-3xl lg:text-[34px]">
                      {ownershipQuestionLines.map((line, index) => (
                        <span
                          key={line}
                          className={`qraft-ownership-line ${
                            index === 0 ? "qraft-ownership-line-own" : "qraft-ownership-line-change"
                          }`}
                        >
                          {line}
                        </span>
                      ))}
                    </h2>
                  </div>

                  <div className="qraft-ownership-right border-t border-[#d9ad73]/14 pt-7 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                    <p className="qraft-ownership-reveal qraft-ownership-reveal-body text-sm font-medium leading-[1.9] tracking-[0.01em] text-[#f5dfbd]/68 [word-break:keep-all] sm:text-[15px]">
                      {ownershipBody}
                    </p>
                    <blockquote className="qraft-ownership-reveal qraft-ownership-reveal-quote mt-8 border-l border-[#d9ad73]/35 pl-5 text-lg font-medium italic leading-[1.6] text-[#f5dfbd]/88 [word-break:keep-all] sm:text-xl">
                      {ownershipQuote}
                    </blockquote>
                    <p className="qraft-ownership-reveal qraft-ownership-reveal-closing mt-8 text-sm font-medium leading-[1.9] tracking-[0.01em] text-[#f5dfbd]/68 [word-break:keep-all] sm:text-[15px]">
                      {ownershipClosing}
                    </p>
                    <div className="qraft-ownership-reveal qraft-ownership-reveal-closing mt-10 flex items-center justify-between gap-4 border-t border-[#d9ad73]/16 pt-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#d2ad7c]/45">
                      <span>Qraft Engine V1.0</span>
                      <span>Existential Record</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section
              ref={section3Ref}
              className="flex w-full items-center px-6 pb-10 pt-16 text-left sm:min-h-[68vh] sm:pb-16 sm:pt-24"
            >
              <div className="qraft-top-reveal mx-auto w-full max-w-6xl">
                <div className="qraft-process-header">
                  <p className="font-mono text-[10px] font-medium uppercase leading-none tracking-[0.2em] text-[#d2ad7c]/55">
                    03 / Process
                  </p>
                  <div className="mt-6 h-px w-full bg-[#d9ad73]/16" />
                  <h2 className="mt-8 text-2xl font-medium leading-tight text-[#f5dfbd]/82 sm:text-4xl">
                    사유의 3단계
                  </h2>
                </div>

                <div className="qraft-phase-grid mt-10 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-3">
                  {phaseCards.map((phase, index) => (
                    <div
                      key={phase.phase}
                      className="qraft-process-step"
                      style={
                        {
                          "--process-step-progress": `var(--process-card-${index + 1}-progress, 0)`,
                          "--process-step-y": `var(--process-card-${index + 1}-y, 54px)`,
                        } as CSSProperties
                      }
                    >
                      <article
                        className={`qraft-phase-card group min-h-64 px-6 py-6 transition-colors duration-500 sm:min-h-72 sm:px-8 sm:py-8 ${phase.tone}`}
                      >
                        <p className="font-mono text-[10px] font-medium uppercase leading-none tracking-[0.18em] text-[#d2ad7c]/55">
                          {phase.phase}
                        </p>
                        <div className="mt-6">
                          <h3 className="text-2xl font-medium leading-tight text-[#f5dfbd]/82 sm:text-3xl">
                            {phase.title}
                          </h3>
                          <p className="mt-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#d2ad7c]/46">
                            {phase.label}
                          </p>
                        </div>
                        <p className="qraft-phase-copy mt-8 text-sm font-medium leading-[1.82] [word-break:keep-all] sm:text-[15px]">
                          {phase.copy}
                        </p>
                      </article>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section
              ref={silentSectionRef}
              className="qraft-silent-section relative flex w-full items-center overflow-hidden px-6 pb-14 pt-14 text-left sm:min-h-[82vh] sm:pb-16 sm:pt-20"
            >
              <div className="relative mx-auto w-full max-w-4xl">
                <p className="font-mono text-[10px] font-medium uppercase leading-none tracking-[0.18em] text-[#cbd8cf]/45">
                  04 / Silent Record
                </p>
                <h2 className="mt-4 text-lg font-medium leading-tight text-[#dfe9df]/58 sm:text-2xl">
                  타인의 고찰
                </h2>
                <blockquote
                  className={`qraft-scroll-rise qraft-silent-quote mt-9 max-w-3xl text-xl font-medium leading-[1.55] tracking-normal [word-break:keep-all] sm:text-2xl sm:leading-[1.5] ${
                    silentQuoteActive ? "qraft-silent-quote-active" : ""
                  }`}
                  style={{ "--silent-flow-cycle": `${silentRecordCharacterTimings.cycleMs}ms` } as CSSProperties}
                >
                  {silentRecordCharacterTimings.characters.map(({ character, delay }, index) =>
                    delay === null ? (
                      <span aria-hidden="true" key={`space-${index}`}>
                        {" "}
                      </span>
                    ) : (
                      <span
                        className="qraft-silent-character"
                        key={`${character}-${index}`}
                        ref={(element) => {
                          silentCharacterRefs.current[index] = element
                        }}
                      >
                        {character}
                      </span>
                    )
                  )}
                </blockquote>
                <p
                  className="mt-8 font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#cbd8cf]/46"
                  style={{ fontFamily: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
                >
                  — 어느 기록자의 메모 중에서
                </p>
              </div>
            </section>

            <section ref={ctaSectionRef} className="w-full px-6 pb-[64px] pt-0 sm:pb-[22px]">
              <div className="mx-auto flex w-full max-w-4xl flex-col items-center justify-center">
                <button
                  type="button"
                  onClick={scrollToQuestionInput}
                  className="pointer-events-auto rounded-full border border-[#d9ad73]/32 bg-[#f5dfbd]/[0.09] px-7 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-[#f5dfbd]/72 shadow-[0_18px_55px_rgba(13,8,5,0.36)] backdrop-blur-xl transition-all duration-500 hover:border-[#efd3a2]/62 hover:bg-[#f5dfbd]/[0.14] hover:text-[#fff4dc] hover:shadow-[0_22px_70px_rgba(245,223,189,0.1)] focus:outline-none focus-visible:border-[#efd3a2]/80"
                >
                  질문하러 가기
                </button>
                <p
                  className="mt-16 text-center font-mono text-[10px] font-medium leading-none tracking-normal text-[#f5dfbd]/32 sm:mt-20 sm:text-[11px]"
                  style={{ fontFamily: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
                >
                  BGM:{" "}
                  <a
                    href="https://youtu.be/5gO0xpY_Y3E?si=JNe5aJr4ZF0FC_sG"
                    target="_blank"
                    rel="noreferrer"
                    className="transition-colors duration-300 hover:text-[#f5dfbd]/52 focus:outline-none focus-visible:text-[#f5dfbd]/64"
                  >
                    Hans Zimmer - First Step (Cover by dhe Perissann)
                  </a>
                </p>
              </div>
            </section>
          </>
        )}

        {isLoading && (
          <div
            className="flex min-h-72 flex-col items-center justify-center"
            style={{ fontFamily: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif', animation: "qraft-reveal 600ms ease-out forwards" }}
          >
            <div
              aria-hidden="true"
              className={`relative h-40 w-40 transition-[filter] duration-700 ${
                loadingNotice === slowLoadingNotice ? "qraft-loading-extended" : ""
              }`}
            >
              {structureDots.map((dot) => (
                <span
                  key={`${dot.x}-${dot.y}`}
                  className="qraft-structure-dot absolute left-1/2 top-1/2 h-2 w-2 bg-[#efd3a2]/85 shadow-[0_0_24px_rgba(239,211,162,0.62)]"
                  style={
                    {
                      "--x": dot.x,
                      "--y": dot.y,
                      animation: "qraft-structure-gather 4.4s ease-in-out infinite alternate",
                      animationDelay: dot.delay,
                    } as CSSProperties
                  }
                />
              ))}
            </div>

            <p className="mt-7 max-w-md text-center text-sm font-medium leading-[1.7] text-[#f5dfbd]/75 transition-opacity duration-700 [word-break:keep-all] sm:text-base">
              {loadingNotice || loadingMessages[loadingStep]}
            </p>
          </div>
        )}

        {isReady && (
          <div
            className="qraft-ready-card pointer-events-auto w-full max-w-xl overflow-y-auto overscroll-contain border border-[#d9ad73]/25 bg-[#120b07]/55 p-6 text-left shadow-[0_24px_80px_rgba(13,8,5,0.52)] backdrop-blur-xl sm:mt-8 sm:p-8"
            style={{ fontFamily: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif', animation: "qraft-reveal 800ms ease-out forwards" }}
          >
            {summary && (
              <div className="mb-6 border-b border-[#d9ad73]/15 pb-5">
                <p className="font-mono text-[10px] font-medium uppercase leading-none tracking-[0.18em] text-[#d2ad7c]/45">
                  Summary
                </p>
                <p
                  ref={summaryRef}
                  className="mt-3 text-sm font-medium leading-[1.7] text-[#f5dfbd]/62 [overflow-wrap:anywhere] [word-break:keep-all] sm:text-[15px]"
                  style={
                    summaryExpanded
                      ? { maxHeight: "17em", overflowY: "auto" }
                      : {
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 3,
                          overflow: "hidden",
                        }
                  }
                >
                  {displayedSummaryLines.map((line, index) => (
                    <span
                      className={`block ${index > 0 && /^\d+\.\s/.test(line) && !/^\d+\.\s/.test(displayedSummaryLines[index - 1] ?? "") ? "mt-2" : ""}`}
                      key={`${line}-${index}`}
                    >
                      {line}
                    </span>
                  ))}
                </p>
                {summaryOverflowing && (
                  <button
                    type="button"
                    onClick={toggleSummaryExpanded}
                    className="mt-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#d2ad7c]/55 transition-colors duration-300 hover:text-[#f5dfbd]/80 focus:outline-none"
                  >
                    {summaryExpanded ? "접기" : "펼치기"}
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <p className="font-mono text-[10px] font-medium uppercase leading-none tracking-[0.18em] text-[#d2ad7c]/55">
                Questions
              </p>
              <button
                type="button"
                disabled={isLoading}
                onClick={runRegenerate}
                className="border border-[#d9ad73]/25 bg-[#f5dfbd]/[0.08] px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#d2ad7c]/70 transition-colors duration-300 hover:border-[#d9ad73]/55 hover:bg-[#f5dfbd]/[0.12] hover:text-[#f5dfbd]/90 focus:outline-none"
              >
                재생성
              </button>
            </div>
            {saveErrorMessage && (
              <p
                role="status"
                aria-live="polite"
                className="mt-4 text-sm font-medium leading-[1.6] text-[#f5dfbd]/58"
              >
                {saveErrorMessage}
              </p>
            )}
            <ol className="mt-6 flex flex-col gap-8">
              {questions.map((q, i) => (
                <li key={i} className="flex gap-3">
                  <div className="mt-1 flex shrink-0 flex-col items-center gap-2">
                    <span className="font-mono text-xs font-medium text-[#d2ad7c]/50">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <button
                      type="button"
                      onClick={() => saveQuestion(q, i + 1)}
                      aria-label={savedQuestionKeys.has(getQuestionKey(lastSource, q)) ? "저장 취소" : "질문 저장"}
                      className="flex h-6 w-6 -translate-x-px items-center justify-center text-[#d2ad7c]/48 transition-colors duration-300 hover:text-[#f5dfbd]/85 focus:outline-none"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill={savedQuestionKeys.has(getQuestionKey(lastSource, q)) ? "currentColor" : "none"} aria-hidden="true">
                        <path d="M6 3.75h12v16.5l-6-3.75-6 3.75V3.75Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-medium leading-[1.55] text-[#f5dfbd]/88 [overflow-wrap:anywhere] [word-break:keep-all] sm:text-2xl">
                      {q}
                    </p>
                    {reflections[i] && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => toggleReflection(i)}
                          className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#d2ad7c]/50 transition-colors duration-300 hover:text-[#f5dfbd]/78 focus:outline-none"
                        >
                          <span>타인의 고찰</span>
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 12 12"
                            fill="none"
                            className={`transition-transform duration-300 ${
                              openReflectionIndexes.has(i) ? "rotate-90" : ""
                            }`}
                            aria-hidden="true"
                          >
                            <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </button>
                        {openReflectionIndexes.has(i) && (
                          <p
                            className="qraft-reflection mt-3 text-sm font-medium leading-[1.7] text-[#f5dfbd]/62 [overflow-wrap:anywhere] [word-break:keep-all] sm:text-[15px]"
                          >
                            {reflections[i]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {generationState === "error" && (
          <div
            className="pointer-events-auto mt-8 w-full max-w-xl border border-[#d9ad73]/25 bg-[#120b07]/55 p-6 text-center shadow-[0_24px_80px_rgba(13,8,5,0.52)] backdrop-blur-xl sm:p-8"
            style={{ fontFamily: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif', animation: "qraft-reveal 800ms ease-out forwards" }}
          >
            <p className="text-sm font-medium leading-[1.7] text-[#f5dfbd]/75 sm:text-base">
              {errorMessage || "사유의 흐름이 잠시 끊겼습니다. 다시 한번 텍스트를 직조합니다."}
            </p>
            <button
              type="button"
              onClick={resetToIdle}
              className="mt-5 h-10 border border-[#d9ad73]/40 bg-[#f5dfbd]/20 px-5 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#f5dfbd]/85 transition-colors duration-700 hover:border-[#efd3a2]/90 hover:bg-[#8d4f31]/35"
            >
              돌아가기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
