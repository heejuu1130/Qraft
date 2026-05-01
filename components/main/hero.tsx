"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties, type SubmitEvent } from "react"
import { MeshGradient } from "@paper-design/shaders-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/context/AuthContext"
import { useBgm } from "@/context/BgmContext"
import { gtag } from "@/lib/gtag"

const desert = {
  background: "#120b07",
  ember: "#8d4f31",
  sand: "#efd3a2",
}

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

type GenerationState = "idle" | "loading" | "ready" | "error"

type QuestionPayload = {
  summary: string
  questions: string[]
  reflections: string[]
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

type RestoredResultState = Omit<PendingSaveState, "questionIndex">

const refiningDuration = 8400
const refiningStepDuration = refiningDuration / 3
const regenerateDuration = 2000
const regenerateStepDuration = 1000
const questionHistoryStorageKey = "qraft:question-history"
const pendingSaveStorageKey = "qraft:pending-save"
const currentResultStorageKey = "qraft:current-result"

const wait = (duration: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, duration)
  })

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

const isUrlLike = (source: string) => {
  try {
    const url = new URL(source)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
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

    return result
  } catch {
    return null
  }
}

export default function Hero() {
  const [generationState, setGenerationState] = useState<GenerationState>("idle")
  const [loadingStep, setLoadingStep] = useState(0)
  const [summary, setSummary] = useState("")
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [summaryOverflowing, setSummaryOverflowing] = useState(false)
  const [questions, setQuestions] = useState<string[]>([])
  const [reflections, setReflections] = useState<string[]>([])
  const [openReflectionIndexes, setOpenReflectionIndexes] = useState<Set<number>>(() => new Set())
  const [lastSource, setLastSource] = useState("")
  const [savedQuestionKeys, setSavedQuestionKeys] = useState<Set<string>>(() => new Set())
  const [savedQuestionIds, setSavedQuestionIds] = useState<Map<string, string>>(() => new Map())
  const [showLogin, setShowLogin] = useState(false)
  const summaryRef = useRef<HTMLParagraphElement>(null)
  const pendingSaveRestoredRef = useRef(false)
  const step1TimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const result = getInitialResultState()

      if (result) {
        setSummary(result.summary)
        setQuestions(result.questions)
        setReflections(result.reflections)
        setLastSource(result.source)
        setGenerationState("ready")
      }
    }, 0)

    return () => {
      window.clearTimeout(restoreTimer)
      window.clearTimeout(step1TimerRef.current)
    }
  }, [])
  const supabase = useMemo(() => createClient(), [])
  const { user, signOut } = useAuth()
  const { bgmOn, toggleBgm } = useBgm()
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
  const isRevealing = isLoading && loadingStep === 2
  const isRefined = isLoading || isReady
  const speed = isRefined ? 0.25 : 0.5
  const backgroundTreatment = isReady
    ? "scale-[1.03] blur-[14px]"
    : isRevealing
      ? "scale-105 blur-[28px]"
      : isLoading
        ? "scale-[1.03] blur-[14px]"
        : "scale-100 blur-0"

  const resetToIdle = () => {
    window.sessionStorage.removeItem(currentResultStorageKey)
    setGenerationState("idle")
  }

  useEffect(() => {
    let cancelled = false

    const loadSavedQuestionKeys = async () => {
      if (user) {
        const { data, error } = await supabase
          .from("saved_questions")
          .select("id, source, question")

        if (cancelled) return

        if (error) {
          console.error(error)
          setSavedQuestionKeys(new Set())
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
            questionIds.set(getQuestionKey(item.source, item.question), item.id)
          })

        setSavedQuestionKeys(new Set(questionIds.keys()))
        setSavedQuestionIds(questionIds)
        return
      }

      await Promise.resolve()
      if (!cancelled) {
        setSavedQuestionKeys(new Set())
        setSavedQuestionIds(new Map())
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
        reflections,
      } satisfies RestoredResultState)
    )
  }, [isReady, lastSource, questions, reflections, summary])

  useEffect(() => {
    const summaryElement = summaryRef.current
    if (!summaryElement || !summary) {
      setSummaryOverflowing(false)
      return
    }

    const lineHeight = Number.parseFloat(window.getComputedStyle(summaryElement).lineHeight)
    const collapsedHeight = lineHeight * 3

    setSummaryOverflowing(summaryElement.scrollHeight > collapsedHeight + 1)
  }, [summary, summaryExpanded, isReady])

  const generateQuestions = async (source: string) => {
    gtag.questionGenerateRequest({
      signed_in: Boolean(user),
      source_type: isUrlLike(source) ? "url" : source.length < 100 ? "topic" : "text",
    })
    setLoadingStep(0)
    setSummary("")
    setSummaryExpanded(false)
    setSummaryOverflowing(false)
    setQuestions([])
    setReflections([])
    setOpenReflectionIndexes(new Set())
    setLastSource(source)
    setGenerationState("loading")

    step1TimerRef.current = window.setTimeout(() => setLoadingStep(1), refiningStepDuration)

    try {
      const payloadPromise = fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      }).then(async (response) => {
        if (!response.ok) throw new Error("Question API request failed")
        return (await response.json()) as QuestionPayload
      })

      const [payload] = await Promise.all([payloadPromise, wait(refiningDuration)])

      window.clearTimeout(step1TimerRef.current)
      setLoadingStep(2)
      await wait(3000)

      setSummary(payload.summary)
      setQuestions(payload.questions)
      setReflections(payload.reflections)
      await saveHistory(source, payload)
      setGenerationState("ready")
      gtag.questionGenerateSuccess({
        signed_in: Boolean(user),
        question_count: payload.questions.length,
        reflection_count: payload.reflections.length,
      })
    } catch (error) {
      window.clearTimeout(step1TimerRef.current)
      console.error(error)
      setGenerationState("error")
      gtag.questionGenerateFailure({ signed_in: Boolean(user) })
    }
  }

  const runRegenerate = async () => {
    if (!summary) return

    gtag.questionRegenerateRequest()
    setLoadingStep(0)
    setQuestions([])
    setReflections([])
    setOpenReflectionIndexes(new Set())
    setGenerationState("loading")

    step1TimerRef.current = window.setTimeout(() => setLoadingStep(1), regenerateStepDuration)

    try {
      const payloadPromise = fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: lastSource, summary }),
      }).then(async (response) => {
        if (!response.ok) throw new Error("Regenerate API request failed")
        return (await response.json()) as { questions: string[]; reflections: string[] }
      })

      const [payload] = await Promise.all([payloadPromise, wait(regenerateDuration)])

      window.clearTimeout(step1TimerRef.current)
      setLoadingStep(2)
      await wait(3000)

      setQuestions(payload.questions)
      setReflections(payload.reflections)
      setGenerationState("ready")
      gtag.questionRegenerateSuccess({
        question_count: payload.questions.length,
        reflection_count: payload.reflections.length,
      })
    } catch (error) {
      window.clearTimeout(step1TimerRef.current)
      console.error(error)
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
        console.error(error)
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

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const source = String(formData.get("source") ?? "").trim()

    if (!source) return

    await generateQuestions(source)
  }

  const handleRegenerate = async () => {
    await runRegenerate()
  }

  const saveQuestion = async (
    question: string,
    questionIndex: number,
    overrideState?: Pick<PendingSaveState, "source" | "summary">
  ) => {
    const sourceToSave = overrideState?.source ?? lastSource
    const summaryToSave = overrideState?.summary ?? summary
    const questionKey = getQuestionKey(sourceToSave, question)
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
      setShowLogin(true)
      return
    }

    if (savedQuestionKeys.has(questionKey)) {
      const savedQuestionId = savedQuestionIds.get(questionKey)
      const deleteQuery = supabase.from("saved_questions").delete()
      const { error } = savedQuestionId
        ? await deleteQuery.eq("id", savedQuestionId)
        : await deleteQuery.eq("source", sourceToSave).eq("question", question)

      if (error) {
        console.error(error)
        return
      }

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
        question,
        question_index: questionIndex,
      }).select("id").single()

      if (error) {
        console.error(error)
        return
      }

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
      const question = pendingSave.questions[pendingSave.questionIndex - 1]

      if (
        !pendingSave.source ||
        !pendingSave.summary ||
        !Array.isArray(pendingSave.questions) ||
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
        setQuestions(pendingSave.questions)
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
            questions: pendingSave.questions,
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
              questions: pendingSave.questions,
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
            console.error(historyResponse.error)
          }

          if (savedQuestionResponse.error) {
            console.error(savedQuestionResponse.error)
            return
          }

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

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#120b07]">
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
            onClick={() => setShowLogin(true)}
            className="h-10 border border-[#d9ad73]/25 bg-[#f5dfbd]/[0.08] px-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#f5dfbd]/60 shadow-[0_10px_30px_rgba(13,8,5,0.32)] backdrop-blur-md transition-colors duration-500 hover:border-[#d9ad73]/55 hover:text-[#f5dfbd]/90 focus:outline-none"
          >
            Login
          </button>
        )}
      </div>

      {/* 로그인 모달 */}
      {showLogin && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center"
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
          onClick={toggleBgm}
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
        className={`absolute inset-0 transition-[filter,transform] duration-[1600ms] ease-in-out ${backgroundTreatment}`}
      >
        <MeshGradient
          className="absolute inset-0 h-full w-full"
          colors={[desert.background, "#2a170e", desert.ember, desert.sand]}
          speed={speed}
        />

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
      </div>

      {/* 오버레이 */}
      <div
        className={`pointer-events-none absolute inset-0 transition-colors duration-[1600ms] ease-in-out ${
          isReady ? "bg-[#120b07]/84" : isRevealing ? "bg-[#120b07]/68" : "bg-[#120b07]/35"
        }`}
      />

      {/* 메인 콘텐츠 */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 flex flex-col items-center px-6 text-center ${
          isReady ? "justify-center overflow-hidden py-6 sm:justify-start sm:overflow-y-auto sm:py-24" : "justify-center"
        }`}
        style={{ fontFamily: '"Outfit", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
      >
        {generationState === "idle" && (
          <div className="flex w-full flex-col items-center mb-[12vh]">
            <h1 className="relative text-5xl font-medium leading-[1.1] tracking-normal drop-shadow-[0_8px_28px_rgba(13,8,5,0.28)] sm:text-[64px]">
              <span className="text-[#f5dfbd]/90 mix-blend-difference">Qraft</span>
              <span aria-hidden="true" className="absolute inset-0 text-[#efd3a2] mix-blend-overlay">
                Qraft
              </span>
            </h1>
            <p className="relative mt-3 max-w-2xl text-sm font-medium leading-[1.7] tracking-normal sm:text-lg">
              <span className="text-[#f5dfbd]/65 mix-blend-difference">
                답이 아니라 질문이 사람을 깊게 만듭니다
              </span>
              <span aria-hidden="true" className="absolute inset-0 text-[#efd3a2]/70 mix-blend-overlay">
                답이 아니라 질문이 사람을 깊게 만듭니다
              </span>
            </p>

            <form
              onSubmit={handleSubmit}
              className="pointer-events-auto mt-[54px] flex w-full max-w-2xl flex-col gap-3 drop-shadow-[0_18px_44px_rgba(18,11,7,0.42)] sm:flex-row sm:items-end"
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
                  type="text"
                  name="source"
                  placeholder="링크 또는 주제를 입력해주세요"
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
          </div>
        )}

        {isLoading && (
          <div
            className="flex min-h-72 flex-col items-center justify-center"
            style={{ fontFamily: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif', animation: "qraft-reveal 600ms ease-out forwards" }}
          >
            <div aria-hidden="true" className="relative h-40 w-40">
              {structureDots.map((dot) => (
                <span
                  key={`${dot.x}-${dot.y}`}
                  className="absolute left-1/2 top-1/2 h-2 w-2 bg-[#efd3a2]/85 shadow-[0_0_24px_rgba(239,211,162,0.62)]"
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

            <p className="mt-7 text-sm font-medium leading-[1.7] text-[#f5dfbd]/75 transition-opacity duration-700 sm:text-base">
              {loadingMessages[loadingStep]}
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
                  className="mt-3 whitespace-pre-line text-sm font-medium leading-[1.7] text-[#f5dfbd]/62 [overflow-wrap:anywhere] [word-break:keep-all] sm:text-[15px]"
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
                  {summary}
                </p>
                {summaryOverflowing && (
                  <button
                    type="button"
                    onClick={() => setSummaryExpanded((expanded) => !expanded)}
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
                onClick={handleRegenerate}
                className="border border-[#d9ad73]/25 bg-[#f5dfbd]/[0.08] px-3 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#d2ad7c]/70 transition-colors duration-300 hover:border-[#d9ad73]/55 hover:bg-[#f5dfbd]/[0.12] hover:text-[#f5dfbd]/90 focus:outline-none"
              >
                재생성
              </button>
            </div>
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
                            className="qraft-reflection mt-3 whitespace-pre-line text-sm font-medium leading-[1.7] text-[#f5dfbd]/62 [overflow-wrap:anywhere] [word-break:keep-all] sm:text-[15px]"
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
              사유의 흐름이 잠시 끊겼습니다. 다시 한번 텍스트를 직조합니다.
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
