"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, type CSSProperties } from "react"
import { useAuth } from "@/context/AuthContext"
import { useBgm } from "@/context/BgmContext"
import { createClient } from "@/lib/supabase/client"
import { gtag } from "@/lib/gtag"
import { logClientError } from "@/lib/client-error"
import { SummaryText } from "@/lib/summary-display"
import {
  createCommunityId,
  removeCommunityReflection,
  upsertCommunityThreadByQuestion,
  type CommunityReflectionEntry,
  type CommunityThread,
} from "@/lib/community-reflections"
import { isLocalDevUser } from "@/lib/local-dev-auth"
import { normalizeQuestionEndingTone, normalizeQuestionListTone } from "@/lib/question-tone"
import { fetchSourceDisplayTitle, getSourceDisplayTitle, isSourceTitleFetchable } from "@/lib/source-display"
import {
  isMissingSavedQuestionColumnError,
  normalizeReflectionVisibility,
  readPersonalNoteEntries,
  readSavedQuestionMeta,
  removeSavedQuestionMeta,
  serializePersonalNoteEntries,
  type PersonalNoteEntry,
  type ReflectionVisibility,
  type SavedQuestionLocalMeta,
  upsertSavedQuestionMeta,
} from "@/lib/saved-reflections"

type SavedQuestion = {
  id: string
  source: string
  summary: string
  question: string
  questionIndex: number
  reflection: string
  personalNote: string
  visibility: ReflectionVisibility
  savedAt: string
  sharedAt: string | null
}

type NoteShareRemovalTarget = {
  entries: PersonalNoteEntry[]
  question: string
  savedQuestion: SavedQuestion
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
  reflection?: string | null
  personal_note?: string | null
  visibility?: string | null
  created_at: string
  shared_at?: string | null
}

type DbCommunityQuestionRow = {
  id: string
  source: string
  summary: string | null
  question: string
  created_at: string
  updated_at: string
}

type DbCommunityReflectionRow = {
  id: string
  community_question_id: string
  body: string
  created_at: string
  updated_at: string
}

type ProfileTab = "history" | "saved" | "notes"

const getProfileTabFromUrl = (): ProfileTab => {
  if (typeof window === "undefined") return "history"

  const tab = new URLSearchParams(window.location.search).get("tab")

  return tab === "saved" || tab === "notes" || tab === "history" ? tab : "history"
}

const navButtonClass =
  "flex h-10 w-10 items-center justify-center border border-[#d9ad73]/30 bg-[#f5dfbd]/[0.08] text-[#f5dfbd]/55 shadow-[0_10px_30px_rgba(13,8,5,0.32)] backdrop-blur-md transition-colors duration-500 hover:border-[#d9ad73]/55 hover:text-[#f5dfbd]/90 focus:outline-none focus-visible:border-[#d9ad73]/70"
const trashIconMaskStyle = {
  WebkitMask: "url('/icons/iconamoon-trash.png') center / 118% 118% no-repeat",
  mask: "url('/icons/iconamoon-trash.png') center / 118% 118% no-repeat",
} satisfies CSSProperties

const questionHistoryStorageKey = "qraft:question-history"
const currentResultStorageKey = "qraft:current-result"
const personalNoteMaxLength = 300

const getScopedStorageKey = (baseKey: string, userId?: string | null) =>
  `${baseKey}:${userId ?? "guest"}`

const clearCurrentResult = () => {
  try {
    window.sessionStorage.removeItem(currentResultStorageKey)
  } catch {}
}

const toStringList = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

const mapHistoryRow = (row: DbQuestionHistoryRow): QuestionHistory => ({
  id: row.id,
  source: row.source,
  summary: row.summary,
  questions: normalizeQuestionListTone(toStringList(row.questions)),
  reflections: toStringList(row.reflections),
  generatedAt: row.created_at,
})

const mapSavedQuestionRow = (
  row: DbSavedQuestionRow,
  localMeta?: ReturnType<typeof readSavedQuestionMeta>[string]
): SavedQuestion => ({
  id: row.id,
  source: row.source,
  summary: row.summary ?? localMeta?.summary ?? "",
  question: normalizeQuestionEndingTone(row.question),
  questionIndex: row.question_index,
  reflection: row.reflection ?? localMeta?.reflection ?? "",
  personalNote: row.personal_note ?? localMeta?.personalNote ?? "",
  visibility: normalizeReflectionVisibility(row.visibility ?? localMeta?.visibility),
  savedAt: row.created_at,
  sharedAt: row.shared_at ?? localMeta?.sharedAt ?? null,
})

const mapSavedQuestionLocalMeta = (item: SavedQuestionLocalMeta): SavedQuestion => ({
  id: item.id,
  source: item.source,
  summary: item.summary,
  question: normalizeQuestionEndingTone(item.question),
  questionIndex: item.questionIndex,
  reflection: item.reflection,
  personalNote: item.personalNote,
  visibility: item.visibility,
  savedAt: item.savedAt,
  sharedAt: item.sharedAt,
})

const isLocalQuestionHistory = (value: unknown): value is QuestionHistory => {
  if (!value || typeof value !== "object") return false

  const item = value as Record<string, unknown>

  return (
    typeof item.id === "string" &&
    typeof item.source === "string" &&
    typeof item.summary === "string" &&
    Array.isArray(item.questions) &&
    item.questions.every((question) => typeof question === "string") &&
    (item.reflections === undefined ||
      (Array.isArray(item.reflections) && item.reflections.every((reflection) => typeof reflection === "string"))) &&
    typeof item.generatedAt === "string"
  )
}

const readLocalQuestionHistory = (userId?: string | null) => {
  if (typeof window === "undefined") return []

  try {
    const rawHistory = window.localStorage.getItem(getScopedStorageKey(questionHistoryStorageKey, userId))
    if (!rawHistory) return []

    const parsed = JSON.parse(rawHistory)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(isLocalQuestionHistory)
      .map((item) => ({
        ...item,
        questions: normalizeQuestionListTone(item.questions),
      }))
  } catch {
    return []
  }
}

const writeLocalQuestionHistory = (userId: string | null | undefined, history: QuestionHistory[]) => {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(getScopedStorageKey(questionHistoryStorageKey, userId), JSON.stringify(history))
  } catch {}
}

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

const getHistoryTitle = (source: string, sourceTitleOverrides: Record<string, string>) =>
  getSourceDisplayTitle(source, sourceTitleOverrides[source])

const getPersonalNoteCardId = (savedQuestionId: string, entryId: string) => `${savedQuestionId}-${entryId}`

const isMissingCommunityTableError = (error: unknown) => {
  const text = JSON.stringify(error).toLowerCase()

  return ["42p01", "pgrst205", "schema cache", "community_questions", "community_reflections"].some(
    (keyword) => text.includes(keyword)
  )
}

export default function ProfilePage() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<ProfileTab>("history")
  const [urlTabApplied, setUrlTabApplied] = useState(false)
  const [openHistoryIds, setOpenHistoryIds] = useState<Set<string>>(() => new Set())
  const [openSavedSummaryIds, setOpenSavedSummaryIds] = useState<Set<string>>(() => new Set())
  const [openSavedReflectionIds, setOpenSavedReflectionIds] = useState<Set<string>>(() => new Set())
  const [openSavedNoteIds, setOpenSavedNoteIds] = useState<Set<string>>(() => new Set())
  const [openNoteSummaryIds, setOpenNoteSummaryIds] = useState<Set<string>>(() => new Set())
  const [history, setHistory] = useState<QuestionHistory[]>([])
  const [savedQuestions, setSavedQuestions] = useState<SavedQuestion[]>([])
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [noteShareRemovalTarget, setNoteShareRemovalTarget] = useState<NoteShareRemovalTarget | null>(null)
  const [sharingNoteIds, setSharingNoteIds] = useState<Set<string>>(() => new Set())
  const [sourceTitleOverrides, setSourceTitleOverrides] = useState<Record<string, string>>({})
  const [profileErrorMessage, setProfileErrorMessage] = useState("")
  const [profileDataLoading, setProfileDataLoading] = useState(true)
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
    const applyUrlTabTimer = window.setTimeout(() => {
      setActiveTab(getProfileTabFromUrl())
      setUrlTabApplied(true)
    }, 0)

    return () => window.clearTimeout(applyUrlTabTimer)
  }, [])

  useEffect(() => {
    if (!urlTabApplied || activeTab !== "history") return

    gtag.profileHistoryView()
  }, [activeTab, urlTabApplied])

  useEffect(() => {
    let cancelled = false

    const loadProfileData = async () => {
      if (loading) return

      if (!user) {
        setHistory([])
        setSavedQuestions([])
        setNoteDrafts({})
        setOpenHistoryIds(new Set())
        setProfileErrorMessage("")
        setProfileDataLoading(false)
        return
      }

      setProfileDataLoading(true)

      try {
        if (isLocalDevUser(user)) {
          const mappedQuestions = Object.values(readSavedQuestionMeta(user.id))
            .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
            .map(mapSavedQuestionLocalMeta)

          if (cancelled) return

          setHistory(readLocalQuestionHistory(user.id))
          setSavedQuestions(mappedQuestions)
          setNoteDrafts({})
          setProfileErrorMessage("")
          return
        }

        if (user) {
          const [historyResponse, initialSavedQuestionsResponse] = await Promise.all([
            supabase
              .from("question_history")
              .select("id, source, summary, questions, reflections, created_at")
              .order("created_at", { ascending: false }),
            supabase
              .from("saved_questions")
              .select("id, source, summary, question, question_index, reflection, personal_note, visibility, shared_at, created_at")
              .order("created_at", { ascending: false }),
          ])
          let savedQuestionsData = initialSavedQuestionsResponse.data
          let savedQuestionsError = initialSavedQuestionsResponse.error

          if (savedQuestionsError && isMissingSavedQuestionColumnError(savedQuestionsError)) {
            const fallbackSavedQuestionsResponse = await supabase
              .from("saved_questions")
              .select("id, source, summary, question, question_index, created_at")
              .order("created_at", { ascending: false })

            savedQuestionsData = fallbackSavedQuestionsResponse.data as typeof savedQuestionsData
            savedQuestionsError = fallbackSavedQuestionsResponse.error
          }

          if (cancelled) return

          if (historyResponse.error) {
            logClientError("profile.history.load", historyResponse.error)
            setHistory([])
          } else {
            setHistory(((historyResponse.data ?? []) as DbQuestionHistoryRow[]).map(mapHistoryRow))
          }

          if (savedQuestionsError) {
            logClientError("profile.saved_questions.load", savedQuestionsError)
            setSavedQuestions([])
          } else {
            const localMeta = readSavedQuestionMeta(user.id)
            const mappedQuestions = ((savedQuestionsData ?? []) as DbSavedQuestionRow[]).map((row) =>
              mapSavedQuestionRow(row, localMeta[row.id])
            )

            setSavedQuestions(mappedQuestions)
            setNoteDrafts({})
          }

          setProfileErrorMessage(
            historyResponse.error || savedQuestionsError
              ? "프로필 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."
              : ""
          )
          return
        }
      } catch (error) {
        if (cancelled) return

        logClientError("profile.data.load", error)
        setHistory([])
        setSavedQuestions([])
        setNoteDrafts({})
        setProfileErrorMessage("프로필 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")
      } finally {
        if (!cancelled) {
          setProfileDataLoading(false)
        }
      }
    }

    loadProfileData()

    return () => {
      cancelled = true
    }
  }, [loading, supabase, user])

  useEffect(() => {
    const sources = Array.from(
      new Set(
        [...history.map((item) => item.source), ...savedQuestions.map((item) => item.source)]
          .map((source) => source.trim())
          .filter((source) => source && isSourceTitleFetchable(source) && !sourceTitleOverrides[source])
      )
    )

    if (sources.length === 0) return

    let cancelled = false

    Promise.all(
      sources.map(async (source) => ({
        source,
        title: await fetchSourceDisplayTitle(source),
      }))
    ).then((results) => {
      if (cancelled) return

      setSourceTitleOverrides((currentTitles) => {
        const nextTitles = { ...currentTitles }
        let changed = false

        results.forEach(({ source, title }) => {
          if (!title || nextTitles[source]) return

          nextTitles[source] = title
          changed = true
        })

        return changed ? nextTitles : currentTitles
      })
    })

    return () => {
      cancelled = true
    }
  }, [history, savedQuestions, sourceTitleOverrides])

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

    if (typeof window !== "undefined") {
      const nextUrl = tab === "history" ? "/profile" : `/profile?tab=${tab}`

      window.history.replaceState(null, "", nextUrl)
    }
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

  const toggleSavedReflection = (id: string) => {
    setOpenSavedReflectionIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(id)) {
        nextIds.delete(id)
      } else {
        nextIds.add(id)
      }

      return nextIds
    })
  }

  const toggleSavedSummary = (id: string) => {
    setOpenSavedSummaryIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(id)) {
        nextIds.delete(id)
      } else {
        nextIds.add(id)
      }

      return nextIds
    })
  }

  const toggleSavedNote = (id: string) => {
    setOpenSavedNoteIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(id)) {
        nextIds.delete(id)
      } else {
        nextIds.add(id)
      }

      return nextIds
    })
  }

  const toggleNoteSummary = (id: string) => {
    setOpenNoteSummaryIds((currentIds) => {
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
    if (isLocalDevUser(user)) {
      const nextHistory = history.filter((item) => item.id !== id)

      writeLocalQuestionHistory(user?.id, nextHistory)
      setProfileErrorMessage("")
      setHistory(nextHistory)
      setOpenHistoryIds((currentIds) => {
        const nextIds = new Set(currentIds)
        nextIds.delete(id)
        return nextIds
      })
      return
    }

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
    if (isLocalDevUser(user)) {
      setProfileErrorMessage("")
      setSavedQuestions((currentQuestions) => currentQuestions.filter((item) => item.id !== id))
      setNoteDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts }
        delete nextDrafts[id]
        return nextDrafts
      })
      removeSavedQuestionMeta(user?.id, id)
      return
    }

    if (user) {
      const { error } = await supabase.from("saved_questions").delete().eq("id", id)

      if (error) {
        logClientError("profile.saved_question.delete", error)
        setProfileErrorMessage("저장한 질문을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.")
        return
      }

      setProfileErrorMessage("")
      setSavedQuestions((currentQuestions) => currentQuestions.filter((item) => item.id !== id))
      setNoteDrafts((currentDrafts) => {
        const nextDrafts = { ...currentDrafts }
        delete nextDrafts[id]
        return nextDrafts
      })
      removeSavedQuestionMeta(user.id, id)
      return
    }
  }

  const rememberSavedQuestion = (item: SavedQuestion) => {
    upsertSavedQuestionMeta(user?.id, {
      id: item.id,
      source: item.source,
      summary: item.summary,
      question: item.question,
      questionIndex: item.questionIndex,
      reflection: item.reflection,
      personalNote: item.personalNote,
      visibility: item.visibility,
      savedAt: item.savedAt,
      updatedAt: new Date().toISOString(),
      sharedAt: item.visibility === "community" ? item.sharedAt ?? new Date().toISOString() : null,
    })
  }

  const createSavedQuestionNoteEntry = (text: string): PersonalNoteEntry => {
    const now = new Date().toISOString()

    return {
      id: crypto.randomUUID(),
      text,
      createdAt: now,
      updatedAt: now,
    }
  }

  const persistSavedQuestionDetails = async (item: SavedQuestion) => {
    if (!user) return false

    if (isLocalDevUser(user)) {
      rememberSavedQuestion(item)
      setProfileErrorMessage("")
      return true
    }

    const { error } = await supabase
      .from("saved_questions")
      .update({
        personal_note: item.personalNote,
        reflection: item.reflection || null,
        shared_at: item.visibility === "community" ? item.sharedAt ?? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
        visibility: item.visibility,
      })
      .eq("id", item.id)

    if (error && !isMissingSavedQuestionColumnError(error)) {
      logClientError("profile.saved_question.update", error)
      setProfileErrorMessage("저장한 고찰을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.")
      return false
    }

    rememberSavedQuestion(item)
    setProfileErrorMessage("")
    return true
  }

  const updateSavedQuestionEntries = async (item: SavedQuestion, entries: PersonalNoteEntry[]) => {
    const nextItem = {
      ...item,
      personalNote: serializePersonalNoteEntries(entries),
    }

    setSavedQuestions((currentQuestions) =>
      currentQuestions.map((question) => (question.id === item.id ? nextItem : question))
    )

    return persistSavedQuestionDetails(nextItem)
  }

  const findOrCreateCommunityQuestion = async (item: SavedQuestion) => {
    if (!user) throw new Error("User is required")

    const existingResponse = await supabase
      .from("community_questions")
      .select("id, source, summary, question, created_at, updated_at")
      .eq("source", item.source)
      .eq("question", item.question)
      .limit(1)

    if (existingResponse.error) throw existingResponse.error

    const existingQuestion = existingResponse.data?.[0] as DbCommunityQuestionRow | undefined

    if (existingQuestion) return existingQuestion

    const insertResponse = await supabase
      .from("community_questions")
      .insert({
        created_by: user.id,
        question: item.question,
        source: item.source,
        summary: item.summary,
      })
      .select("id, source, summary, question, created_at, updated_at")
      .single()

    if (insertResponse.error) throw insertResponse.error

    return insertResponse.data as DbCommunityQuestionRow
  }

  const insertCommunityReflection = async (communityQuestionId: string, text: string) => {
    if (!user) throw new Error("User is required")

    const reflectionResponse = await supabase
      .from("community_reflections")
      .insert({
        body: text,
        community_question_id: communityQuestionId,
        user_id: user.id,
      })
      .select("id, community_question_id, body, created_at, updated_at")
      .single()

    if (reflectionResponse.error) throw reflectionResponse.error

    return reflectionResponse.data as DbCommunityReflectionRow
  }

  const sharePersonalNoteEntries = async (item: SavedQuestion, entriesToShare: PersonalNoteEntry[]) => {
    if (!user) return

    const targetEntries = entriesToShare.filter((entry) => !entry.communitySharedAt)
    const noteIds = targetEntries.map((entry) => getPersonalNoteCardId(item.id, entry.id))

    if (targetEntries.length === 0) return

    setSharingNoteIds((currentIds) => new Set([...currentIds, ...noteIds]))

    try {
      const entries = readPersonalNoteEntries(item.personalNote)
      const now = new Date().toISOString()
      let shareMode: "local_dev" | "local_fallback" | "remote" = isLocalDevUser(user) ? "local_dev" : "remote"
      const sharedEntries = new Map<
        string,
        {
          communityReflectionId: string
          communitySharedAt: string
          communityThreadId: string
        }
      >()

      const shareLocally = () => {
        shareMode = isLocalDevUser(user) ? "local_dev" : "local_fallback"
        const communityThreadId =
          targetEntries.find((entry) => entry.communityThreadId)?.communityThreadId ??
          createCommunityId("community-thread")
        const localThread = upsertCommunityThreadByQuestion({
          id: communityThreadId,
          remoteQuestionId: null,
          createdBy: user.id,
          source: item.source,
          summary: item.summary,
          question: item.question,
          reflections: targetEntries.map((entry) => {
            const communityReflectionId = entry.communityReflectionId ?? `local-share-${item.id}-${entry.id}`

            sharedEntries.set(entry.id, {
              communityReflectionId,
              communitySharedAt: now,
              communityThreadId,
            })

            return {
              authorId: user.id,
              id: communityReflectionId,
              text: entry.text,
              authorLabel: "내 고찰",
              createdAt: entry.createdAt || now,
              updatedAt: now,
            } satisfies CommunityReflectionEntry
          }),
          createdAt: item.savedAt,
          updatedAt: now,
        } satisfies CommunityThread)

        sharedEntries.forEach((sharedEntry, entryId) => {
          sharedEntries.set(entryId, {
            ...sharedEntry,
            communityThreadId: localThread.id,
          })
        })
      }

      if (isLocalDevUser(user)) {
        shareLocally()
      } else {
        try {
          const communityQuestion = await findOrCreateCommunityQuestion(item)
          const communityReflections = await Promise.all(
            targetEntries.map(async (entry) => ({
              entry,
              reflection: await insertCommunityReflection(communityQuestion.id, entry.text),
            }))
          )

          communityReflections.forEach(({ entry, reflection }) => {
            sharedEntries.set(entry.id, {
              communityReflectionId: reflection.id,
              communitySharedAt: reflection.created_at,
              communityThreadId: communityQuestion.id,
            })
          })
        } catch (error) {
          if (!isMissingCommunityTableError(error)) {
            logClientError("profile.community_reflection.share", error)
            setProfileErrorMessage("커뮤니티에 고찰을 공유하지 못했습니다. 잠시 후 다시 시도해 주세요.")
            gtag.personalNoteShareFailure({
              note_count: targetEntries.length,
              reason: "remote_error",
            })
            return
          }

          shareLocally()
          setProfileErrorMessage("커뮤니티 테이블이 아직 준비되지 않아 이 기기에서만 보이도록 공유했습니다.")
        }
      }

      const nextEntries = entries.map((currentEntry) => {
        const sharedEntry = sharedEntries.get(currentEntry.id)

        return sharedEntry
          ? {
              ...currentEntry,
              ...sharedEntry,
              updatedAt: now,
            }
          : currentEntry
      })

      const persisted = await updateSavedQuestionEntries(item, nextEntries)

      if (!persisted) {
        gtag.personalNoteShareFailure({
          note_count: targetEntries.length,
          reason: "persist_failed",
        })
        return
      }

      gtag.personalNoteShareToCommunity({
        note_count: targetEntries.length,
        share_mode: shareMode,
      })
      if (isLocalDevUser(user)) {
        setProfileErrorMessage("")
      }
    } finally {
      setSharingNoteIds((currentIds) => {
        const nextIds = new Set(currentIds)

        noteIds.forEach((noteId) => nextIds.delete(noteId))
        return nextIds
      })
    }
  }

  const sharePersonalNoteCard = async (item: SavedQuestion) => {
    await sharePersonalNoteEntries(item, readPersonalNoteEntries(item.personalNote))
  }

  const requestRemovePersonalNoteShare = (item: {
    entries: PersonalNoteEntry[]
    question: string
    savedQuestion: SavedQuestion
  }) => {
    setNoteShareRemovalTarget({
      entries: item.entries.filter((entry) => Boolean(entry.communitySharedAt || entry.communityReflectionId)),
      question: item.question,
      savedQuestion: item.savedQuestion,
    })
  }

  const removePersonalNoteShare = async () => {
    const target = noteShareRemovalTarget

    if (!target || !user) return

    const entries = readPersonalNoteEntries(target.savedQuestion.personalNote)
    const targetEntryIds = new Set(target.entries.map((entry) => entry.id))
    const targetEntries = entries.filter(
      (entry) => targetEntryIds.has(entry.id) && Boolean(entry.communitySharedAt || entry.communityReflectionId)
    )
    const noteIds = targetEntries.map((entry) => getPersonalNoteCardId(target.savedQuestion.id, entry.id))

    if (targetEntries.length === 0) {
      setNoteShareRemovalTarget(null)
      return
    }

    setSharingNoteIds((currentIds) => new Set([...currentIds, ...noteIds]))

    try {
      if (!isLocalDevUser(user)) {
        const remoteReflectionIds = targetEntries
          .map((entry) => entry.communityReflectionId)
          .filter((id): id is string => Boolean(id && !id.startsWith("local-share-")))

        if (remoteReflectionIds.length > 0) {
          const { error } = await supabase
            .from("community_reflections")
            .delete()
            .in("id", remoteReflectionIds)
            .eq("user_id", user.id)

          if (error && !isMissingCommunityTableError(error)) {
            logClientError("profile.community_reflection.unshare", error)
            setProfileErrorMessage("커뮤니티 공유를 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.")
            return
          }
        }

        const communityThreadIds = Array.from(
          new Set(targetEntries.map((entry) => entry.communityThreadId).filter((id): id is string => Boolean(id)))
        )

        await Promise.all(
          communityThreadIds.map(async (threadId) => {
            const { count, error: countError } = await supabase
              .from("community_reflections")
              .select("id", { count: "exact", head: true })
              .eq("community_question_id", threadId)

            if (countError || count !== 0) return

            const { error } = await supabase
              .from("community_questions")
              .delete()
              .eq("id", threadId)
              .eq("created_by", user.id)

            if (error && !isMissingCommunityTableError(error)) {
              logClientError("profile.community_question.cleanup", error)
            }
          })
        )
      }

      targetEntries.forEach((entry) => {
        if (entry.communityReflectionId) {
          removeCommunityReflection(entry.communityThreadId ?? null, entry.communityReflectionId)
        }
      })

      const now = new Date().toISOString()
      const nextEntries = entries.map((entry) =>
        targetEntryIds.has(entry.id)
          ? {
              ...entry,
              communityReflectionId: null,
              communitySharedAt: null,
              communityThreadId: null,
              updatedAt: now,
            }
          : entry
      )
      const persisted = await updateSavedQuestionEntries(target.savedQuestion, nextEntries)

      if (!persisted) return

      setNoteShareRemovalTarget(null)
      setProfileErrorMessage("")
    } finally {
      setSharingNoteIds((currentIds) => {
        const nextIds = new Set(currentIds)

        noteIds.forEach((noteId) => nextIds.delete(noteId))
        return nextIds
      })
    }
  }

  const updateSavedQuestionNote = async (item: SavedQuestion) => {
    const draft = (noteDrafts[item.id] ?? "").trim()

    if (!draft) return

    const entries = readPersonalNoteEntries(item.personalNote)
    const nextEntries = [...entries, createSavedQuestionNoteEntry(draft)]
    const nextItem = {
      ...item,
      personalNote: serializePersonalNoteEntries(nextEntries),
    }

    setSavedQuestions((currentQuestions) =>
      currentQuestions.map((question) => (question.id === item.id ? nextItem : question))
    )
    const persisted = await persistSavedQuestionDetails(nextItem)

    if (!persisted) return

    gtag.personalNoteCreate({
      existing_note_count: entries.length,
      note_length: draft.length,
      surface: "profile_saved",
    })
    setNoteDrafts((currentDrafts) => ({ ...currentDrafts, [item.id]: "" }))
  }

  const deleteSavedQuestionNote = async (item: SavedQuestion, entryId: string) => {
    const entries = readPersonalNoteEntries(item.personalNote)
    const nextEntries = entries.filter((entry) => entry.id !== entryId)
    const nextItem = {
      ...item,
      personalNote: serializePersonalNoteEntries(nextEntries),
    }

    setNoteDrafts((currentDrafts) => ({ ...currentDrafts, [item.id]: "" }))
    setSavedQuestions((currentQuestions) =>
      currentQuestions.map((question) => (question.id === item.id ? nextItem : question))
    )
    const persisted = await persistSavedQuestionDetails(nextItem)

    if (!persisted) return

    gtag.personalNoteDelete({
      remaining_note_count: nextEntries.length,
      surface: "profile",
    })
  }

  const deleteSavedQuestionNotes = async (item: SavedQuestion) => {
    const entries = readPersonalNoteEntries(item.personalNote)
    const nextItem = {
      ...item,
      personalNote: "",
    }

    setNoteDrafts((currentDrafts) => ({ ...currentDrafts, [item.id]: "" }))
    setSavedQuestions((currentQuestions) =>
      currentQuestions.map((question) => (question.id === item.id ? nextItem : question))
    )
    const persisted = await persistSavedQuestionDetails(nextItem)

    if (!persisted) return

    gtag.personalNoteGroupDelete({
      note_count: entries.length,
      surface: "profile",
    })
  }

  const goBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push("/")
    }
  }

  const goHome = () => {
    clearCurrentResult()
    router.push("/")
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

  const personalNoteGroups = savedQuestions
    .map((item) => ({
      entries: readPersonalNoteEntries(item.personalNote),
      id: item.id,
      question: item.question,
      savedQuestion: item,
      summary: item.summary,
      sourceTitle: getHistoryTitle(item.source, sourceTitleOverrides),
    }))
    .filter((item) => item.entries.length > 0)

  const renderSavedQuestionCard = (item: SavedQuestion) => {
    const draft = noteDrafts[item.id] ?? ""
    const hasNote = draft.trim().length > 0
    const noteEntries = readPersonalNoteEntries(item.personalNote)
    const hasSummary = item.summary.trim().length > 0
    const summaryOpen = openSavedSummaryIds.has(item.id)
    const reflectionOpen = openSavedReflectionIds.has(item.id)
    const noteOpen = openSavedNoteIds.has(item.id)
    const detailOpen = Boolean((item.reflection && reflectionOpen) || noteOpen)

    return (
      <article
        key={item.id}
        className="w-full min-w-0 border border-[#d9ad73]/18 bg-[#120b07]/55 p-5 shadow-[0_18px_50px_rgba(13,8,5,0.34)] backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-medium uppercase leading-none tracking-[0.16em] text-[#d2ad7c]/50">
              Question {String(item.questionIndex).padStart(2, "0")}
            </p>
            {hasSummary ? (
              <button
                type="button"
                onClick={() => toggleSavedSummary(item.id)}
                title="요약 보기"
                className="mt-2 block max-w-full truncate text-left text-xs font-medium leading-[1.5] text-[#f5dfbd]/36 underline-offset-4 transition-colors duration-300 hover:text-[#f5dfbd]/66 hover:underline focus:outline-none"
              >
                {getHistoryTitle(item.source, sourceTitleOverrides)}
              </button>
            ) : (
              <p className="mt-2 truncate text-xs font-medium leading-[1.5] text-[#f5dfbd]/36">
                {getHistoryTitle(item.source, sourceTitleOverrides)}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-start gap-3">
            <time className="font-mono text-[10px] leading-none text-[#f5dfbd]/32">
              {formatDate(item.savedAt)}
            </time>
            <DeleteButton
              compact
              label="저장한 질문 삭제"
              onClick={() => deleteSavedQuestion(item.id)}
            />
          </div>
        </div>
        {summaryOpen && hasSummary && (
          <SummaryText
            className="mt-4 border-t border-[#d9ad73]/12 pt-4 text-xs font-medium leading-[1.75] text-[#f5dfbd]/50 [overflow-wrap:anywhere] [word-break:keep-all]"
            summary={item.summary}
          />
        )}
        <p className={`${summaryOpen && hasSummary ? "mt-4" : "mt-3"} text-xl font-medium leading-[1.55] text-[#f5dfbd]/88 [overflow-wrap:anywhere] [word-break:keep-all]`}>
          {item.question}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {item.reflection && (
            <button
              type="button"
              onClick={() => toggleSavedReflection(item.id)}
              className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#d2ad7c]/50 transition-colors duration-300 hover:text-[#f5dfbd]/78 focus:outline-none"
            >
              <span>타인의 고찰</span>
              <svg
                width="11"
                height="11"
                viewBox="0 0 12 12"
                fill="none"
                className={`transition-transform duration-300 ${reflectionOpen ? "rotate-90" : ""}`}
                aria-hidden="true"
              >
                <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => toggleSavedNote(item.id)}
            className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#d2ad7c]/50 transition-colors duration-300 hover:text-[#f5dfbd]/78 focus:outline-none"
          >
            <span>내 고찰</span>
            {noteEntries.length > 0 && (
              <span className="h-1.5 w-1.5 rounded-full bg-[#efd3a2]/68" aria-hidden="true" />
            )}
            <svg
              width="11"
              height="11"
              viewBox="0 0 12 12"
              fill="none"
              className={`transition-transform duration-300 ${noteOpen ? "rotate-90" : ""}`}
              aria-hidden="true"
            >
              <path d="M4.5 2.5L8 6L4.5 9.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {detailOpen && (
          <div className="mt-4">
            {item.reflection && reflectionOpen && (
              <p className="text-sm leading-[1.7] text-[#f5dfbd]/56 [overflow-wrap:anywhere] [word-break:keep-all]">
                {item.reflection}
              </p>
            )}
            {item.reflection && reflectionOpen && noteOpen && (
              <div className="my-5 border-t border-[#d9ad73]/12" aria-hidden="true" />
            )}
            {noteOpen && (
              <section>
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#d2ad7c]/50">
                  내 고찰
                </p>
                {noteEntries.length > 0 && (
                  <div className="mt-3 flex flex-col">
                    {noteEntries.map((entry, entryIndex) => (
                      <article
                        key={entry.id}
                        className={entryIndex === 0 ? "pb-4" : "border-t border-[#d9ad73]/12 py-4"}
                      >
                        <div className="flex items-start gap-4">
                          <p className="min-w-0 flex-1 whitespace-pre-line text-sm font-medium leading-[1.7] text-[#f5dfbd]/68 [overflow-wrap:anywhere] [word-break:keep-all]">
                            {entry.text}
                          </p>
                          <button
                            type="button"
                            onClick={() => deleteSavedQuestionNote(item, entry.id)}
                            aria-label="내 고찰 삭제"
                            className="flex h-7 w-7 shrink-0 items-center justify-center text-[#d2ad7c]/42 transition-colors duration-300 hover:text-[#f5dfbd]/78 focus:outline-none"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                              <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                            </svg>
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                <textarea
                  id={`saved-note-${item.id}`}
                  value={draft}
                  onChange={(event) =>
                    setNoteDrafts((currentDrafts) => ({
                      ...currentDrafts,
                      [item.id]: event.target.value.slice(0, personalNoteMaxLength),
                    }))
                  }
                  maxLength={personalNoteMaxLength}
                  rows={4}
                  placeholder="이 질문에 대한 내 생각을 남겨보세요."
                  className={`${noteEntries.length > 0 ? "mt-4" : "mt-3"} min-h-28 w-full resize-none border border-[#d9ad73]/16 bg-[#080403]/28 px-3 py-3 text-base font-medium leading-[1.7] text-[#f5dfbd]/78 outline-none transition-colors duration-300 placeholder:text-[#d2ad7c]/34 focus:border-[#d9ad73]/42 sm:text-sm`}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => updateSavedQuestionNote(item)}
                    disabled={!hasNote}
                    className="rounded-full border border-[#d9ad73]/26 bg-[#f5dfbd]/[0.07] px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-[#f5dfbd]/66 transition-colors duration-300 hover:border-[#efd3a2]/52 hover:bg-[#f5dfbd]/[0.12] hover:text-[#fff4dc] disabled:cursor-not-allowed disabled:border-[#d9ad73]/12 disabled:text-[#f5dfbd]/28"
                  >
                    저장
                  </button>
                </div>
              </section>
            )}
          </div>
        )}
      </article>
    )
  }

  const renderPersonalNoteCard = (item: {
    entries: PersonalNoteEntry[]
    id: string
    question: string
    savedQuestion: SavedQuestion
    summary: string
    sourceTitle: string
  }) => {
    const isShared = item.entries.every((entry) => Boolean(entry.communitySharedAt))
    const isSharing = item.entries.some((entry) =>
      sharingNoteIds.has(getPersonalNoteCardId(item.savedQuestion.id, entry.id))
    )
    const summaryOpen = openNoteSummaryIds.has(item.id)
    const shareButtonLabel = isSharing ? (isShared ? "취소 중" : "공유 중") : isShared ? "공유됨" : "공유"
    const shareButtonAriaLabel = isSharing
      ? isShared
        ? "커뮤니티 공유 취소 중"
        : "커뮤니티 공유 중"
      : isShared
        ? "커뮤니티 공유 취소"
        : "커뮤니티에 공유"

    return (
      <article
        key={item.id}
        className="border border-[#d9ad73]/18 bg-[#120b07]/55 p-5 shadow-[0_18px_50px_rgba(13,8,5,0.34)] backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-4">
          {item.summary.trim() ? (
            <button
              type="button"
              onClick={() => toggleNoteSummary(item.id)}
              title="요약 보기"
              className="min-w-0 -translate-y-[4px] truncate text-left font-mono text-xs font-medium leading-[1.5] tracking-[0.12em] text-[#d2ad7c]/46 underline-offset-4 transition-colors duration-300 hover:text-[#f5dfbd]/72 hover:underline focus:outline-none"
            >
              {item.sourceTitle}
            </button>
          ) : (
            <p className="min-w-0 -translate-y-[4px] truncate font-mono text-xs font-medium leading-[1.5] tracking-[0.12em] text-[#d2ad7c]/42">
              {item.sourceTitle}
            </p>
          )}
          <div className={`flex shrink-0 items-start ${isShared ? "gap-3" : "gap-1.5"}`}>
            <button
              type="button"
              onClick={() => {
                if (isShared) {
                  requestRemovePersonalNoteShare(item)
                  return
                }

                void sharePersonalNoteCard(item.savedQuestion)
              }}
              disabled={isSharing}
              aria-busy={isSharing}
              aria-label={shareButtonAriaLabel}
              style={{
                paddingLeft: isShared ? 9 : 11,
                paddingRight: isShared ? 7 : 5,
                transform: "translateY(-4px)",
              }}
              className={`flex h-[18px] min-w-[48px] items-center justify-center rounded-full border font-mono text-[11px] font-medium uppercase leading-none tracking-[0.1em] transition-colors duration-300 focus:outline-none disabled:cursor-wait disabled:opacity-70 ${
                isShared
                  ? "border-[#8d4f31]/46 bg-[#8d4f31]/18 text-[#efd3a2]/88 hover:border-[#d9ad73]/60 hover:bg-[#8d4f31]/28 hover:text-[#fff4dc]"
                  : "border-transparent text-[#d2ad7c]/42 hover:text-[#f5dfbd]/78"
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M8.75 12.75L15.25 16.25M15.25 7.75L8.75 11.25" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  <path d="M6.5 14.5C7.88 14.5 9 13.38 9 12C9 10.62 7.88 9.5 6.5 9.5C5.12 9.5 4 10.62 4 12C4 13.38 5.12 14.5 6.5 14.5Z" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M17.5 9.5C18.88 9.5 20 8.38 20 7C20 5.62 18.88 4.5 17.5 4.5C16.12 4.5 15 5.62 15 7C15 8.38 16.12 9.5 17.5 9.5Z" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M17.5 19.5C18.88 19.5 20 18.38 20 17C20 15.62 18.88 14.5 17.5 14.5C16.12 14.5 15 15.62 15 17C15 18.38 16.12 19.5 17.5 19.5Z" stroke="currentColor" strokeWidth="1.7" />
                </svg>
                <span>{shareButtonLabel}</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => deleteSavedQuestionNotes(item.savedQuestion)}
              aria-label="내 고찰 전체 삭제"
              className="flex h-[15px] w-[15px] shrink-0 items-center justify-center text-[#d2ad7c]/42 transition-colors duration-300 hover:text-[#f5dfbd]/78 focus:outline-none"
            >
              <TrashIcon className="h-[15px] w-[13px] -translate-y-[3px]" />
            </button>
          </div>
        </div>
        {summaryOpen && item.summary.trim() && (
          <SummaryText
            className="mb-4 mt-3 border-t border-[#d9ad73]/12 pt-4 text-[13px] font-medium leading-[1.75] text-[#f5dfbd]/50 [overflow-wrap:anywhere] [word-break:keep-all]"
            summary={item.summary}
          />
        )}
        <p className={`${summaryOpen && item.summary.trim() ? "" : "mt-3"} text-base font-medium leading-[1.6] text-[#f5dfbd]/86 [overflow-wrap:anywhere] [word-break:keep-all]`}>
          {item.question}
        </p>
        <div className="mt-4 border-t border-[#d9ad73]/12">
          {item.entries.map((entry, entryIndex) => (
            <article
              key={entry.id}
              className={
                entryIndex === 0
                  ? item.entries.length === 1
                    ? "pt-4"
                    : "pb-4 pt-4"
                  : entryIndex === item.entries.length - 1
                    ? "border-t border-[#d9ad73]/12 pt-4"
                    : "border-t border-[#d9ad73]/12 py-4"
              }
            >
              <div className="flex items-start gap-4">
                <p className="min-w-0 flex-1 whitespace-pre-line text-sm font-medium leading-[1.75] text-[#f5dfbd]/68 [overflow-wrap:anywhere] [word-break:keep-all]">
                  {entry.text}
                </p>
                <button
                  type="button"
                  onClick={() => deleteSavedQuestionNote(item.savedQuestion, entry.id)}
                  aria-label="내 고찰 삭제"
                  className="flex h-7 w-7 shrink-0 items-center justify-center text-[#d2ad7c]/42 transition-colors duration-300 hover:text-[#f5dfbd]/78 focus:outline-none"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </article>
          ))}
        </div>
      </article>
    )
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

        <button type="button" onClick={goHome} aria-label="홈으로" className={navButtonClass}>
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
      <nav className="fixed right-4 top-4 z-20 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex h-10 items-center px-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#f5dfbd]/48 transition-colors duration-500 hover:text-[#f5dfbd]/82 focus:outline-none"
        >
          Logout
        </button>
        <Link
          href="/community"
          className="inline-flex h-10 items-center border border-[#d9ad73]/38 bg-[#d19045]/[0.2] px-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-[#efd3a2]/68 shadow-[0_12px_32px_rgba(13,8,5,0.34)] ring-1 ring-[#efd3a2]/[0.02] backdrop-blur-md transition-colors duration-500 hover:border-[#d9ad73]/56 hover:bg-[#d19045]/[0.3] hover:text-[#fff4dc] focus:outline-none"
        >
          Community
        </Link>
      </nav>
      <div className="relative mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 py-6 sm:px-8">
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

        <section className="mt-5 grid gap-3 sm:grid-cols-3" aria-label="프로필 기능 안내">
          <div className="border-l border-[#d9ad73]/18 pl-3">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-[#d2ad7c]/58 [word-spacing:-0.28em]">
              히스토리
            </p>
            <p className="mt-2 text-xs font-medium leading-[1.65] text-[#f5dfbd]/44 [word-break:keep-all]">
              생성했던 질문과 요약을 다시 확인합니다.
            </p>
          </div>
          <div className="border-l border-[#d9ad73]/18 pl-3">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-[#d2ad7c]/58 [word-spacing:-0.28em]">
              저장한 질문
            </p>
            <p className="mt-2 text-xs font-medium leading-[1.65] text-[#f5dfbd]/44 [word-break:keep-all]">
              다시 보고 싶은 질문과 고찰을 모아둡니다.
            </p>
          </div>
          <div className="border-l border-[#d9ad73]/18 pl-3">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-[#d2ad7c]/58 [word-spacing:-0.28em]">
              내 고찰
            </p>
            <p className="mt-2 text-xs font-medium leading-[1.65] text-[#f5dfbd]/44 [word-break:keep-all]">
              내가 남긴 생각을 모아보고 커뮤니티에 공유합니다.
            </p>
          </div>
        </section>

        <nav className="mt-10 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => selectProfileTab("history")}
            className={`h-11 border px-5 font-mono text-xs font-medium uppercase tracking-[0.13em] transition-colors focus:outline-none ${
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
            className={`h-11 border px-5 font-mono text-xs font-medium uppercase tracking-[0.13em] transition-colors focus:outline-none ${
              activeTab === "saved"
                ? "border-[#d9ad73]/55 bg-[#f5dfbd]/[0.12] text-[#f5dfbd]/85"
                : "border-[#d9ad73]/20 bg-[#f5dfbd]/[0.05] text-[#f5dfbd]/45 hover:text-[#f5dfbd]/75"
            }`}
          >
            저장한 질문
          </button>
          <button
            type="button"
            onClick={() => selectProfileTab("notes")}
            className={`h-11 border px-5 font-mono text-xs font-medium uppercase tracking-[0.13em] transition-colors focus:outline-none ${
              activeTab === "notes"
                ? "border-[#d9ad73]/55 bg-[#f5dfbd]/[0.12] text-[#f5dfbd]/85"
                : "border-[#d9ad73]/20 bg-[#f5dfbd]/[0.05] text-[#f5dfbd]/45 hover:text-[#f5dfbd]/75"
            }`}
          >
            내 고찰
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
              {profileDataLoading ? (
                <LoadingState text="히스토리를 불러오고 있습니다." />
              ) : history.length === 0 ? (
                <EmptyState text="아직 생성 히스토리가 없습니다." />
              ) : (
                history.map((item) => (
                  <article
                    key={item.id}
                    className="border border-[#d9ad73]/18 bg-[#120b07]/55 p-5 shadow-[0_18px_50px_rgba(13,8,5,0.34)] backdrop-blur-xl"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-medium leading-none text-[#f5dfbd]/86 [overflow-wrap:anywhere] [word-break:keep-all]">
                          {getHistoryTitle(item.source, sourceTitleOverrides)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-start gap-3">
                        <time className="font-mono text-[10px] leading-none text-[#f5dfbd]/32">
                          {formatDate(item.generatedAt)}
                        </time>
                        <DeleteButton
                          compact
                          label="히스토리 삭제"
                          onClick={() => deleteHistory(item.id)}
                        />
                      </div>
                    </div>
                    <div className="mt-5">
                      <SummaryText
                        className="text-sm leading-[1.7] text-[#f5dfbd]/58 [overflow-wrap:anywhere] [word-break:keep-all]"
                        summary={item.summary}
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
                      />
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
                              <span className="shrink-0 font-mono text-[11px] text-[#d2ad7c]/45">
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
              {profileDataLoading ? (
                <LoadingState text="저장한 질문을 불러오고 있습니다." />
              ) : savedQuestions.length === 0 ? (
                <EmptyState text="아직 저장한 질문이 없습니다." />
              ) : (
                savedQuestions.map(renderSavedQuestionCard)
              )}
            </div>
          )}

          {activeTab === "notes" && (
            <div>
              {profileDataLoading ? (
                <LoadingState text="내 고찰을 불러오고 있습니다." />
              ) : personalNoteGroups.length === 0 ? (
                <EmptyState text="아직 내 고찰이 남겨진 질문이 없습니다." />
              ) : (
                <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-2">
                  {personalNoteGroups.map(renderPersonalNoteCard)}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
      {noteShareRemovalTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#080403]/70 px-5 backdrop-blur-md"
          role="presentation"
          onClick={() => setNoteShareRemovalTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-unshare-note-title"
            className="w-full max-w-sm border border-[#d9ad73]/24 bg-[#120b07]/95 p-6 shadow-[0_24px_80px_rgba(13,8,5,0.72)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              id="profile-unshare-note-title"
              className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#d2ad7c]/55"
            >
              공유 취소
            </p>
            <p className="mt-4 text-sm font-medium leading-[1.75] text-[#f5dfbd]/72 [word-break:keep-all]">
              삭제 시 커뮤니티에 공유된 {noteShareRemovalTarget.entries.length}개의 내 고찰이 사라집니다.
              함께 달린 타인의 생각은 남겨두고 내 고찰만 삭제됩니다. 정말 공유를 취소하시겠습니까?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setNoteShareRemovalTarget(null)}
                className="border border-[#d9ad73]/18 bg-[#f5dfbd]/[0.04] px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#f5dfbd]/46 transition-colors duration-300 hover:text-[#f5dfbd]/72 focus:outline-none"
              >
                취소
              </button>
              <button
                type="button"
                onClick={removePersonalNoteShare}
                className="border border-[#d9ad73]/30 bg-[#8d4f31]/18 px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#efd3a2]/78 transition-colors duration-300 hover:border-[#efd3a2]/52 hover:bg-[#8d4f31]/28 hover:text-[#fff4dc] focus:outline-none"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
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

function LoadingState({ text }: { text: string }) {
  return (
    <div className="border border-[#d9ad73]/15 bg-[#f5dfbd]/[0.04] p-8 text-center" aria-live="polite">
      <p className="text-sm font-medium text-[#f5dfbd]/54">{text}</p>
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
            onClick={clearCurrentResult}
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
  compact = false,
  label,
  onClick,
}: {
  compact?: boolean
  label: string
  onClick: () => void
}) {
  const buttonClass = compact
    ? "flex h-[15px] w-[15px] shrink-0 items-center justify-center text-[#d2ad7c]/42 transition-colors duration-300 hover:text-[#f5dfbd]/78 focus:outline-none"
    : "flex h-[30px] w-[30px] items-center justify-center text-[#f5dfbd]/35 transition-colors duration-300 hover:text-[#f5dfbd]/75 focus:outline-none"

  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={buttonClass}
    >
      <TrashIcon className={compact ? "h-[15px] w-[13px] -translate-y-[3px]" : "h-5 w-[18px] -translate-y-[2px]"} />
    </button>
  )
}

function TrashIcon({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block shrink-0 bg-current ${className}`}
      style={trashIconMaskStyle}
    />
  )
}
