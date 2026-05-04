"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/context/AuthContext"
import { useBgm } from "@/context/BgmContext"
import { createClient } from "@/lib/supabase/client"
import { gtag } from "@/lib/gtag"
import { logClientError } from "@/lib/client-error"

type SavedQuestion = {
  id: string
  source: string
  summary: string
  question: string
  questionIndex: number
  savedAt: string
}

type QuestionHistory = {
  id: string
  source: string
  summary: string
  questions: string[]
  reflections?: string[]
  generatedAt: string
}

type DbQuestionHistoryRow = {
  id: string
  source: string
  summary: string
  questions: unknown
  reflections: unknown
  created_at: string
}

type DbSavedQuestionRow = {
  id: string
  source: string
  summary: string | null
  question: string
  question_index: number
  created_at: string
}

type ProfileTab = "history" | "saved"

const navButtonClass =
  "flex h-10 w-10 items-center justify-center border border-[#d9ad73]/30 bg-[#f5dfbd]/[0.08] text-[#f5dfbd]/55 shadow-[0_10px_30px_rgba(13,8,5,0.32)] backdrop-blur-md transition-colors duration-500 hover:border-[#d9ad73]/55 hover:text-[#f5dfbd]/90 focus:outline-none focus-visible:border-[#d9ad73]/70"

const toStringList = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

const mapHistoryRow = (row: DbQuestionHistoryRow): QuestionHistory => ({
  id: row.id,
  source: row.source,
  summary: row.summary,
  questions: toStringList(row.questions),
  reflections: toStringList(row.reflections),
  generatedAt: row.created_at,
})

const mapSavedQuestionRow = (row: DbSavedQuestionRow): SavedQuestion => ({
  id: row.id,
  source: row.source,
  summary: row.summary ?? "",
  question: row.question,
  questionIndex: row.question_index,
  savedAt: row.created_at,
})

const getDisplayName = (user: ReturnType<typeof useAuth>["user"]) => {
  if (!user) return "Guest"

  const metadata = user.user_metadata
  const name = metadata.name ?? metadata.full_name ?? metadata.nickname ?? metadata.preferred_username

  if (typeof name === "string" && name.trim()) return name.trim()
  if (user.email) return user.email.split("@")[0]

  return "Profile"
}

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

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))

const getHistoryTitle = (source: string) => {
  try {
    const url = new URL(source)
    return url.hostname.replace(/^www\./, "")
  } catch {
    return source
  }
}

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<ProfileTab>("history")
  const [openHistoryIds, setOpenHistoryIds] = useState<Set<string>>(() => new Set())
  const [history, setHistory] = useState<QuestionHistory[]>([])
  const [savedQuestions, setSavedQuestions] = useState<SavedQuestion[]>([])
  const [profileErrorMessage, setProfileErrorMessage] = useState("")
  const supabase = useMemo(() => createClient(), [])
  const { bgmOn, toggleBgm } = useBgm()

  const profileName = getDisplayName(user)
  const profileImageUrl = getProfileImageUrl(user)
  const profileInitial =
    user?.user_metadata.full_name?.charAt(0) ??
    user?.user_metadata.name?.charAt(0) ??
    user?.user_metadata.nickname?.charAt(0) ??
    user?.email?.charAt(0) ??
    "Q"

  useEffect(() => {
    gtag.profileHistoryView()
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadProfileData = async () => {
      if (loading) return

      if (!user) {
        setHistory([])
        setSavedQuestions([])
        setOpenHistoryIds(new Set())
        setProfileErrorMessage("")
        return
      }

      if (user) {
        const [historyResponse, savedQuestionsResponse] = await Promise.all([
          supabase
            .from("question_history")
            .select("id, source, summary, questions, reflections, created_at")
            .order("created_at", { ascending: false }),
          supabase
            .from("saved_questions")
            .select("id, source, summary, question, question_index, created_at")
            .order("created_at", { ascending: false }),
        ])

        if (cancelled) return

        if (historyResponse.error) {
          logClientError("profile.history.load", historyResponse.error)
          setHistory([])
        } else {
          setHistory(((historyResponse.data ?? []) as DbQuestionHistoryRow[]).map(mapHistoryRow))
        }

        if (savedQuestionsResponse.error) {
          logClientError("profile.saved_questions.load", savedQuestionsResponse.error)
          setSavedQuestions([])
        } else {
          setSavedQuestions(
            ((savedQuestionsResponse.data ?? []) as DbSavedQuestionRow[]).map(mapSavedQuestionRow)
          )
        }

        setProfileErrorMessage(
          historyResponse.error || savedQuestionsResponse.error
            ? "프로필 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
            : ""
        )
        return
      }
    }

    loadProfileData()

    return () => {
      cancelled = true
    }
  }, [loading, supabase, user])

  const handleBgmToggle = () => {
    gtag.bgmToggle({
      next_state: bgmOn ? "off" : "on",
      surface: "profile",
    })
    toggleBgm()
  }

  const selectProfileTab = (tab: ProfileTab) => {
    gtag.profileTabSelect({ tab })
    setActiveTab(tab)
  }

  const toggleHistory = (id: string) => {
    const expanded = !openHistoryIds.has(id)

    gtag.profileHistoryToggle({ expanded })

    setOpenHistoryIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(id)) {
        nextIds.delete(id)
      } else {
        nextIds.add(id)
      }

      return nextIds
    })
  }

  const deleteHistory = async (id: string) => {
    if (user) {
      const { error } = await supabase.from("question_history").delete().eq("id", id)

      if (error) {
        logClientError("profile.history.delete", error)
        setProfileErrorMessage("히스토리를 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.")
        return
      }

      setProfileErrorMessage("")
      setHistory((currentHistory) => currentHistory.filter((item) => item.id !== id))
      setOpenHistoryIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.delete(id)
        return nextIds
      })
      return
    }
  }

  const deleteSavedQuestion = async (id: string) => {
    if (user) {
      const { error } = await supabase.from("saved_questions").delete().eq("id", id)

      if (error) {
        logClientError("profile.saved_question.delete", error)
        setProfileErrorMessage("저장한 질문을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.")
        return
      }

      setProfileErrorMessage("")
      setSavedQuestions((currentQuestions) => currentQuestions.filter((item) => item.id !== id))
      return
    }
  }

  const goBack = () => {
    if (window.history.length > 1) {
      window.history.back()
    } else {
      window.location.href = "/"
    }
  }

  const handleSignOut = async () => {
    setProfileErrorMessage("")

    try {
      await signOut()
    } catch (error) {
      logClientError("profile.sign_out", error)
      setProfileErrorMessage("로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.")
    }
  }

  if (loading) {
    return <ProfileStatusView eyebrow="Profile" title="로그인 상태를 확인하고 있습니다." />
  }

  if (!user) {
    return (
      <ProfileStatusView
        eyebrow="Profile"
        title="로그인이 필요합니다."
        description="저장한 질문과 히스토리는 로그인 후 확인할 수 있습니다."
        actionHref="/auth"
        actionLabel="로그인하기"
      />
    )
  }

  return (
    <main className="min-h-screen bg-[#120b07] text-[#f5dfbd]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(217,173,115,0.16),transparent_34%),radial-gradient(circle_at_75%_38%,rgba(141,79,49,0.22),transparent_32%),#120b07]" />
      <nav className="fixed left-4 top-4 z-20 flex items-center gap-1.5">
        <button type="button" onClick={goBack} aria-label="뒤로가기" className={navButtonClass}>
          <svg width="19" height="19" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M8 2.5L4 6.5L8 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <Link href="/" aria-label="홈으로" className={navButtonClass}>
          <svg width="19" height="19" viewBox="0 0 13 13" fill="none" aria-hidden="true">
            <path d="M1.5 6.5L6.5 2L11.5 6.5V11.5H8.5V8.5H4.5V11.5H1.5V6.5Z" fill="currentColor" />
          </svg>
        </Link>

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
      <div className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={handleSignOut}
            className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#f5dfbd]/42 transition-colors hover:text-[#f5dfbd]/80 focus:outline-none"
          >
            Logout
          </button>
        </header>

        <section className="mt-10 flex items-center gap-4 border-b border-[#d9ad73]/15 pb-8">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#d9ad73]/30 bg-[#f5dfbd]/10 font-mono text-lg font-semibold uppercase text-[#f5dfbd]/75">
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
          </div>
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#d2ad7c]/50">
              Profile
            </p>
            <h1 className="mt-2 truncate text-2xl font-medium tracking-normal text-[#f5dfbd]/90">
              {profileName}
            </h1>
            <p className="mt-1 truncate text-sm text-[#f5dfbd]/45">
              {user?.email ?? "로그인 정보가 없습니다"}
            </p>
          </div>
        </section>

        <nav className="mt-7 flex gap-2">
          <button
            type="button"
            onClick={() => selectProfileTab("history")}
            className={`h-10 border px-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] transition-colors focus:outline-none ${
              activeTab === "history"
                ? "border-[#d9ad73]/55 bg-[#f5dfbd]/[0.12] text-[#f5dfbd]/85"
                : "border-[#d9ad73]/20 bg-[#f5dfbd]/[0.05] text-[#f5dfbd]/45 hover:text-[#f5dfbd]/75"
            }`}
          >
            히스토리
          </button>
          <button
            type="button"
            onClick={() => selectProfileTab("saved")}
            className={`h-10 border px-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] transition-colors focus:outline-none ${
              activeTab === "saved"
                ? "border-[#d9ad73]/55 bg-[#f5dfbd]/[0.12] text-[#f5dfbd]/85"
                : "border-[#d9ad73]/20 bg-[#f5dfbd]/[0.05] text-[#f5dfbd]/45 hover:text-[#f5dfbd]/75"
            }`}
          >
            저장한 질문
          </button>
        </nav>

        <section className="mt-6 flex-1 pb-16">
          {profileErrorMessage && (
            <div className="mb-4 border border-[#d9ad73]/25 bg-[#f5dfbd]/[0.06] px-4 py-3">
              <p className="text-sm font-medium leading-[1.6] text-[#f5dfbd]/68">
                {profileErrorMessage}
              </p>
            </div>
          )}

          {activeTab === "history" && (
            <div className="flex flex-col gap-4">
              {history.length === 0 ? (
                <EmptyState text="아직 생성 히스토리가 없습니다." />
              ) : (
                history.map((item) => (
                  <article
                    key={item.id}
                    className="border border-[#d9ad73]/18 bg-[#120b07]/55 p-5 shadow-[0_18px_50px_rgba(13,8,5,0.34)] backdrop-blur-xl"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-medium leading-[1.45] text-[#f5dfbd]/86 [overflow-wrap:anywhere] [word-break:keep-all]">
                          {getHistoryTitle(item.source)}
                        </p>
                        <p className="mt-2 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[#d2ad7c]/42">
                          {item.source}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <time className="font-mono text-[10px] text-[#f5dfbd]/32">
                          {formatDate(item.generatedAt)}
                        </time>
                        <DeleteButton
                          label="히스토리 삭제"
                          onClick={() => deleteHistory(item.id)}
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <p
                        className="whitespace-pre-line text-sm leading-[1.7] text-[#f5dfbd]/58 [overflow-wrap:anywhere] [word-break:keep-all]"
                        style={
                          openHistoryIds.has(item.id)
                            ? undefined
                            : {
                                display: "-webkit-box",
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 3,
                                overflow: "hidden",
                              }
                        }
                      >
                        {item.summary}
                      </p>
                      {!openHistoryIds.has(item.id) && (
                        <HistoryToggleButton
                          expanded={false}
                          onClick={() => toggleHistory(item.id)}
                        />
                      )}
                    </div>
                    {openHistoryIds.has(item.id) && (
                      <>
                        <ol className="mt-5 flex flex-col gap-3 border-t border-[#d9ad73]/12 pt-5">
                          {item.questions.map((question, index) => (
                            <li key={`${item.id}-${index}`} className="flex gap-3">
                              <span className="mt-1 shrink-0 font-mono text-[11px] text-[#d2ad7c]/45">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <p className="text-base leading-[1.65] text-[#f5dfbd]/78 [overflow-wrap:anywhere] [word-break:keep-all]">
                                {question}
                              </p>
                            </li>
                          ))}
                        </ol>
                        <HistoryToggleButton
                          expanded
                          onClick={() => toggleHistory(item.id)}
                        />
                      </>
                    )}
                  </article>
                ))
              )}
            </div>
          )}

          {activeTab === "saved" && (
            <div className="flex flex-col gap-4">
              {savedQuestions.length === 0 ? (
                <EmptyState text="아직 저장한 질문이 없습니다." />
              ) : (
                savedQuestions.map((item) => (
                  <article
                    key={item.id}
                    className="border border-[#d9ad73]/18 bg-[#120b07]/55 p-5 shadow-[0_18px_50px_rgba(13,8,5,0.34)] backdrop-blur-xl"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#d2ad7c]/50">
                        Question {String(item.questionIndex).padStart(2, "0")}
                      </p>
                      <div className="flex shrink-0 items-center gap-2">
                        <time className="font-mono text-[10px] text-[#f5dfbd]/32">
                          {formatDate(item.savedAt)}
                        </time>
                        <DeleteButton
                          label="저장한 질문 삭제"
                          onClick={() => deleteSavedQuestion(item.id)}
                        />
                      </div>
                    </div>
                    <p className="mt-4 text-xl font-medium leading-[1.55] text-[#f5dfbd]/88 [overflow-wrap:anywhere] [word-break:keep-all]">
                      {item.question}
                    </p>
                    <p className="mt-4 truncate font-mono text-[10px] uppercase tracking-[0.14em] text-[#f5dfbd]/32">
                      {item.source}
                    </p>
                  </article>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="border border-[#d9ad73]/15 bg-[#f5dfbd]/[0.04] p-8 text-center">
      <p className="text-sm font-medium text-[#f5dfbd]/48">{text}</p>
    </div>
  )
}

function ProfileStatusView({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  eyebrow: string
  title: string
  description?: string
  actionHref?: string
  actionLabel?: string
}) {
  return (
    <main className="min-h-screen bg-[#120b07] text-[#f5dfbd]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(217,173,115,0.16),transparent_34%),radial-gradient(circle_at_75%_38%,rgba(141,79,49,0.22),transparent_32%),#120b07]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#d2ad7c]/50">
          {eyebrow}
        </p>
        <h1 className="mt-4 text-2xl font-medium leading-tight text-[#f5dfbd]/88">
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-sm font-medium leading-[1.7] text-[#f5dfbd]/52">
            {description}
          </p>
        )}
        <div className="mt-7 flex items-center justify-center gap-3">
          {actionHref && actionLabel && (
            <Link
              href={actionHref}
              className="border border-[#d9ad73]/35 bg-[#f5dfbd]/[0.08] px-5 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#f5dfbd]/75 transition-colors hover:border-[#d9ad73]/60 hover:bg-[#f5dfbd]/[0.12] focus:outline-none"
            >
              {actionLabel}
            </Link>
          )}
          <Link
            href="/"
            className="px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#f5dfbd]/35 transition-colors hover:text-[#f5dfbd]/65 focus:outline-none"
          >
            홈으로
          </Link>
        </div>
      </div>
    </main>
  )
}

function HistoryToggleButton({
  expanded,
  onClick,
}: {
  expanded: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={expanded ? "히스토리 접기" : "히스토리 펼치기"}
      className="mx-auto mt-3 flex h-6 w-10 items-center justify-center text-[#d2ad7c]/55 transition-colors duration-300 hover:text-[#f5dfbd]/85 focus:outline-none"
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 12 12"
        fill="none"
        className={`transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
        aria-hidden="true"
      >
        <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function DeleteButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-[30px] w-[30px] items-center justify-center text-[#f5dfbd]/35 transition-colors duration-300 hover:text-[#f5dfbd]/75 focus:outline-none"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6.5 7.5H17.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M9 7.5V5.5H15V7.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.5 10L9.2 18.5H14.8L15.5 10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
