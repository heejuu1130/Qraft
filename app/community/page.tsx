"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { useAuth } from "@/context/AuthContext"
import { useBgm } from "@/context/BgmContext"
import { logClientError } from "@/lib/client-error"
import { gtag } from "@/lib/gtag"
import { SummaryText } from "@/lib/summary-display"
import { fetchSourceDisplayTitle, getSourceDisplayTitle, isSourceTitleFetchable } from "@/lib/source-display"
import {
  createCommunityId,
  readCommunityFeedCache,
  readCommunityThreadLikes,
  readCommunityThreads,
  removeCommunityReflection,
  removeCommunityThread,
  setCommunityThreadLiked,
  upsertCommunityThread,
  writeCommunityFeedCache,
  type CommunityReflectionEntry,
  type CommunityThread,
} from "@/lib/community-reflections"
import { isLocalDevUser } from "@/lib/local-dev-auth"
import {
  isMissingSavedQuestionColumnError,
  readCommunityReflectionMeta,
  readPersonalNoteEntries,
  readSavedQuestionMeta,
  serializePersonalNoteEntries,
  type SavedQuestionLocalMeta,
  writeSavedQuestionMeta,
} from "@/lib/saved-reflections"
import { createClient } from "@/lib/supabase/client"

type DbCommunityQuestionRow = {
  id: string
  created_by: string | null
  source: string
  summary: string | null
  question: string
  created_at: string
  updated_at: string
}

type DbCommunityReflectionRow = {
  id: string
  community_question_id: string
  user_id: string | null
  body: string
  created_at: string
  updated_at: string
}

type DbSavedQuestionNoteRow = {
  id: string
  personal_note: string | null
}

type DbCommunityQuestionLikeRow = {
  community_question_id: string
  user_id: string
}

type DbLegacyCommunityRow = {
  id: string
  user_id: string | null
  source: string
  summary: string | null
  question: string
  question_index: number
  personal_note: string | null
  shared_at: string | null
  updated_at: string | null
  created_at: string | null
}

const navButtonClass =
  "flex h-10 w-10 items-center justify-center border border-[#d9ad73]/30 bg-[#f5dfbd]/[0.08] text-[#f5dfbd]/55 shadow-[0_10px_30px_rgba(13,8,5,0.32)] backdrop-blur-md transition-colors duration-500 hover:border-[#d9ad73]/55 hover:text-[#f5dfbd]/90 focus:outline-none focus-visible:border-[#d9ad73]/70"
const trashIconMaskStyle = {
  WebkitMask: "url('/icons/iconamoon-trash.png') center / 118% 118% no-repeat",
  mask: "url('/icons/iconamoon-trash.png') center / 118% 118% no-repeat",
} satisfies CSSProperties

const reflectionMaxLength = 300
const currentResultStorageKey = "qraft:current-result"

const clearCurrentResult = () => {
  try {
    window.sessionStorage.removeItem(currentResultStorageKey)
  } catch {}
}

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))

const getSourceTitle = (source: string, sourceTitleOverrides: Record<string, string>) =>
  getSourceDisplayTitle(source, sourceTitleOverrides[source])

const getSourceUrl = (source: string) => {
  try {
    const url = new URL(source)

    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    return url.toString()
  } catch {
    return null
  }
}

const getDisplayName = (user: ReturnType<typeof useAuth>["user"]) => {
  if (!user) return "Profile"

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

const getThreadKey = (thread: Pick<CommunityThread, "source" | "question">) =>
  `${thread.source.trim().toLowerCase()}::${thread.question.trim().toLowerCase()}`

const getTime = (value: string) => {
  const time = new Date(value).getTime()

  return Number.isFinite(time) ? time : 0
}

const getLaterDate = (first: string, second: string) =>
  getTime(first) >= getTime(second) ? first : second

const getEarlierDate = (first: string, second: string) =>
  getTime(first) <= getTime(second) ? first : second

const isMissingCommunityTableError = (error: unknown) => {
  const text = JSON.stringify(error).toLowerCase()

  return [
    "42p01",
    "pgrst205",
    "schema cache",
    "community_questions",
    "community_reflections",
    "community_question_likes",
    "app_admins",
  ].some((keyword) => text.includes(keyword))
}

const isLocalCommunityReflectionId = (id?: string | null) =>
  !id || id.startsWith("local-share-") || id.startsWith("community-reflection-")

const getLegacyRemoteSavedQuestionId = (thread: CommunityThread) =>
  thread.id.startsWith("legacy-remote-") ? thread.id.replace("legacy-remote-", "") : null

const normalizeReflection = (entry: CommunityReflectionEntry): CommunityReflectionEntry => ({
  ...entry,
  text: entry.text.trim(),
})

const getAnonymousAuthorKey = (entry: CommunityReflectionEntry) => entry.authorId?.trim() || `entry:${entry.id}`

const getOtherAuthorLabel = (index: number) =>
  index >= 99 ? "타인 99+" : `타인 ${String(index + 1).padStart(2, "0")}`

const getCommunityAuthorLabels = (
  entries: CommunityReflectionEntry[],
  isAuthorEntry: (entry: CommunityReflectionEntry) => boolean
) => {
  const labels = new Map<string, string>()

  entries.forEach((entry) => {
    if (isAuthorEntry(entry)) return

    const authorKey = getAnonymousAuthorKey(entry)

    if (!labels.has(authorKey)) {
      labels.set(authorKey, getOtherAuthorLabel(labels.size))
    }
  })

  return labels
}

const mergeCommunityThreads = (threads: CommunityThread[]) => {
  const mergedThreads = new Map<string, CommunityThread>()

  threads.forEach((thread) => {
    if (!thread.question.trim()) return

    const cleanThread = {
      ...thread,
      reflections: thread.reflections
        .map(normalizeReflection)
        .filter((entry) => entry.text.length > 0)
        .sort((a, b) => getTime(a.createdAt) - getTime(b.createdAt)),
    }

    const threadKey = getThreadKey(cleanThread)
    const existingThread = mergedThreads.get(threadKey)

    if (!existingThread) {
      mergedThreads.set(threadKey, cleanThread)
      return
    }

    const reflections = new Map<string, CommunityReflectionEntry>()

    existingThread.reflections.forEach((entry) => {
      reflections.set(`${entry.id}:${entry.text}`, entry)
    })
    cleanThread.reflections.forEach((entry) => {
      reflections.set(`${entry.id}:${entry.text}`, entry)
    })

    mergedThreads.set(threadKey, {
      ...existingThread,
      remoteQuestionId: existingThread.remoteQuestionId ?? cleanThread.remoteQuestionId,
      source: existingThread.source || cleanThread.source,
      summary: existingThread.summary || cleanThread.summary,
      createdAt: getEarlierDate(existingThread.createdAt, cleanThread.createdAt),
      updatedAt: getLaterDate(existingThread.updatedAt, cleanThread.updatedAt),
      reflections: Array.from(reflections.values()).sort(
        (a, b) => getTime(a.createdAt) - getTime(b.createdAt)
      ),
    })
  })

  return Array.from(mergedThreads.values()).sort(
    (a, b) => getTime(b.updatedAt) - getTime(a.updatedAt)
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

function SourceLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="mt-2 block max-w-full truncate font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-[#d2ad7c]/42 underline-offset-4 transition-colors duration-300 hover:text-[#f5dfbd]/72 hover:underline focus:outline-none"
    >
      원본 링크
    </a>
  )
}

const mapLocalLegacyThread = (item: SavedQuestionLocalMeta): CommunityThread | null => {
  const noteEntries = readPersonalNoteEntries(item.personalNote)

  if (noteEntries.length === 0) return null

  const sharedAt = item.sharedAt ?? item.updatedAt

  return {
    id: `legacy-local-${item.id}`,
    remoteQuestionId: null,
    createdBy: null,
    source: item.source,
    summary: item.summary,
    question: item.question,
    reflections: noteEntries.map((entry) => ({
      id: `legacy-local-${item.id}-${entry.id}`,
      text: entry.text,
      authorLabel: "생각",
      authorId: null,
      createdAt: entry.createdAt || sharedAt,
      updatedAt: entry.updatedAt || item.updatedAt,
    })),
    createdAt: item.savedAt,
    updatedAt: sharedAt,
  }
}

const mapRemoteCommunityThreads = (
  questions: DbCommunityQuestionRow[],
  reflections: DbCommunityReflectionRow[]
) => {
  const reflectionsByQuestionId = new Map<string, DbCommunityReflectionRow[]>()

  reflections.forEach((entry) => {
    const questionReflections = reflectionsByQuestionId.get(entry.community_question_id) ?? []

    questionReflections.push(entry)
    reflectionsByQuestionId.set(entry.community_question_id, questionReflections)
  })

  return questions.map<CommunityThread>((question) => ({
    id: question.id,
    remoteQuestionId: question.id,
    createdBy: question.created_by,
    source: question.source,
    summary: question.summary ?? "",
    question: question.question,
    reflections: (reflectionsByQuestionId.get(question.id) ?? []).map((entry) => ({
      id: entry.id,
      text: entry.body,
      authorLabel: "생각",
      authorId: entry.user_id,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    })),
    createdAt: question.created_at,
    updatedAt:
      reflectionsByQuestionId
        .get(question.id)
        ?.reduce((latest, entry) => getLaterDate(latest, entry.updated_at), question.updated_at) ??
      question.updated_at,
  }))
}

const mapLegacyRemoteThread = (item: DbLegacyCommunityRow): CommunityThread | null => {
  const noteEntries = readPersonalNoteEntries(item.personal_note)

  if (noteEntries.length === 0) return null

  const sharedAt = item.shared_at ?? item.updated_at ?? item.created_at ?? new Date().toISOString()

  return {
    id: `legacy-remote-${item.id}`,
    remoteQuestionId: null,
    createdBy: item.user_id,
    source: item.source,
    summary: item.summary ?? "",
    question: item.question,
    reflections: noteEntries.map((entry) => ({
      id: `legacy-remote-${item.id}-${entry.id}`,
      text: entry.text,
      authorLabel: "생각",
      authorId: item.user_id,
      createdAt: entry.createdAt || sharedAt,
      updatedAt: entry.updatedAt || sharedAt,
    })),
    createdAt: item.created_at ?? sharedAt,
    updatedAt: sharedAt,
  }
}

export default function CommunityPage() {
  const [threads, setThreads] = useState<CommunityThread[]>([])
  const [reflectionDrafts, setReflectionDrafts] = useState<Record<string, string>>({})
  const [openSummaryIds, setOpenSummaryIds] = useState<Set<string>>(new Set())
  const [savingReflectionIds, setSavingReflectionIds] = useState<Set<string>>(new Set())
  const [deletingReflectionIds, setDeletingReflectionIds] = useState<Set<string>>(new Set())
  const [deletingThreadIds, setDeletingThreadIds] = useState<Set<string>>(new Set())
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({})
  const [likedThreadIds, setLikedThreadIds] = useState<Set<string>>(new Set())
  const [savingLikeThreadIds, setSavingLikeThreadIds] = useState<Set<string>>(new Set())
  const [threadPendingDeletion, setThreadPendingDeletion] = useState<CommunityThread | null>(null)
  const [reflectionPendingDeletion, setReflectionPendingDeletion] = useState<{
    entry: CommunityReflectionEntry
    thread: CommunityThread
  } | null>(null)
  const [showMineOnly, setShowMineOnly] = useState(false)
  const [isCommunityAdmin, setIsCommunityAdmin] = useState(false)
  const [showLoginRequiredModal, setShowLoginRequiredModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const [sourceTitleOverrides, setSourceTitleOverrides] = useState<Record<string, string>>({})
  const communityViewSentRef = useRef(false)
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const { user } = useAuth()
  const { bgmOn, toggleBgm } = useBgm()
  const canUseRemote = Boolean(user && !isLocalDevUser(user))
  const likeActorId = user?.id ?? (process.env.NODE_ENV === "development" ? "local-preview-guest" : null)
  const profileImageUrl = getProfileImageUrl(user)
  const profileName = getDisplayName(user)
  const profileInitial =
    user?.user_metadata.full_name?.charAt(0) ??
    user?.user_metadata.name?.charAt(0) ??
    user?.user_metadata.nickname?.charAt(0) ??
    user?.email?.charAt(0) ??
    "Q"
  const ownSharedReflectionIds = user
    ? new Set(
        Object.values(readSavedQuestionMeta(user.id))
          .flatMap((item) => readPersonalNoteEntries(item.personalNote))
          .map((entry) => entry.communityReflectionId)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      )
    : new Set<string>()

  useEffect(() => {
    if (communityViewSentRef.current) return

    communityViewSentRef.current = true
    gtag.communityView({ signed_in: Boolean(user) })
  }, [user])

  useEffect(() => {
    let cancelled = false

    const loadAdminFlag = async () => {
      if (!user || isLocalDevUser(user)) {
        setIsCommunityAdmin(false)
        return
      }

      const { data, error } = await supabase
        .from("app_admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        if (!isMissingCommunityTableError(error)) {
          logClientError("community.admin_flag.load", error)
        }
        setIsCommunityAdmin(false)
        return
      }

      setIsCommunityAdmin(Boolean(data))
    }

    loadAdminFlag()

    return () => {
      cancelled = true
    }
  }, [supabase, user])

  useEffect(() => {
    let cancelled = false

    const loadCommunity = async () => {
      setLoading(true)

      try {
      const localThreads = readCommunityThreads()
      const cachedThreads = readCommunityFeedCache()
      const localLegacyThreads = readCommunityReflectionMeta()
        .map(mapLocalLegacyThread)
        .filter((thread): thread is CommunityThread => Boolean(thread))
      let remoteQuestionThreads: CommunityThread[] = []
      const remoteLegacyThreads: CommunityThread[] = []
      const remoteLikeCounts: Record<string, number> = {}
      const remoteLikedThreadIds = new Set<string>()
      let remoteErrorMessage = ""
      let shouldKeepCachedThreads = false

      const syncThreadLikes = (
        threadList: CommunityThread[],
        nextRemoteLikeCounts: Record<string, number> = {},
        nextRemoteLikedThreadIds = new Set<string>()
      ) => {
        const localLikes = readCommunityThreadLikes()
        const nextLikeCounts: Record<string, number> = {}
        const nextLikedThreadIds = new Set<string>()

        threadList.forEach((thread) => {
          const localLikedBy = localLikes[thread.id] ?? []
          const remoteLikeKey = thread.remoteQuestionId ?? thread.id

          nextLikeCounts[thread.id] =
            nextRemoteLikeCounts[remoteLikeKey] ?? nextRemoteLikeCounts[thread.id] ?? localLikedBy.length

          if (
            likeActorId &&
            (localLikedBy.includes(likeActorId) ||
              nextRemoteLikedThreadIds.has(remoteLikeKey) ||
              nextRemoteLikedThreadIds.has(thread.id))
          ) {
            nextLikedThreadIds.add(thread.id)
          }
        })

        setLikeCounts(nextLikeCounts)
        setLikedThreadIds(nextLikedThreadIds)
      }

      const publishThreads = (
        threadList: CommunityThread[],
        nextRemoteLikeCounts: Record<string, number> = {},
        nextRemoteLikedThreadIds = new Set<string>(),
        shouldFinishLoading = threadList.length > 0
      ) => {
        if (cancelled) return

        setThreads(threadList)
        syncThreadLikes(threadList, nextRemoteLikeCounts, nextRemoteLikedThreadIds)

        if (shouldFinishLoading) {
          setLoading(false)
        }
      }

      const readLegacyResponse = (legacyResponse: { data: unknown[] | null; error: unknown }) => {
        if (legacyResponse.error) {
          if (!isMissingSavedQuestionColumnError(legacyResponse.error)) {
            logClientError("community.legacy_shared_reflections.load", legacyResponse.error)
            remoteErrorMessage = remoteErrorMessage || "기존 공유 생각 일부를 불러오지 못했습니다."
          }

          return
        }

        remoteLegacyThreads.push(
          ...((legacyResponse.data ?? []) as DbLegacyCommunityRow[])
            .map(mapLegacyRemoteThread)
            .filter((thread): thread is CommunityThread => Boolean(thread))
        )
      }

      const seedThreads = mergeCommunityThreads([...cachedThreads, ...localLegacyThreads, ...localThreads])

      if (seedThreads.length > 0) {
        publishThreads(seedThreads)
      }

      const legacyResponsePromise = supabase
        .from("saved_questions")
        .select("id, user_id, source, summary, question, question_index, personal_note, shared_at, updated_at, created_at")
        .eq("visibility", "community")
        .order("shared_at", { ascending: false, nullsFirst: false })
        .limit(50)
        .then((response) => response)

      const questionsResponse = await supabase
        .from("community_questions")
        .select("id, created_by, source, summary, question, created_at, updated_at")
        .order("updated_at", { ascending: false })
        .limit(60)

      if (!questionsResponse.error && (questionsResponse.data?.length ?? 0) > 0) {
        const questions = (questionsResponse.data ?? []) as DbCommunityQuestionRow[]
        const questionIds = questions.map((item) => item.id)

        remoteQuestionThreads = mapRemoteCommunityThreads(questions, [])

        publishThreads(mergeCommunityThreads([...remoteQuestionThreads, ...seedThreads]))

        const [reflectionResponse, likeResponse, legacyResponse] = await Promise.all([
          supabase
            .from("community_reflections")
            .select("id, community_question_id, user_id, body, created_at, updated_at")
            .in("community_question_id", questionIds)
            .order("created_at", { ascending: true }),
          supabase
            .from("community_question_likes")
            .select("community_question_id, user_id")
            .in("community_question_id", questionIds),
          legacyResponsePromise,
        ])

        if (reflectionResponse.error) {
          if (!isMissingCommunityTableError(reflectionResponse.error)) {
            logClientError("community.reflections.load", reflectionResponse.error)
            remoteErrorMessage = "커뮤니티 생각 일부를 불러오지 못했습니다."
          }
          shouldKeepCachedThreads = true
        } else {
          remoteQuestionThreads = mapRemoteCommunityThreads(
            questions,
            (reflectionResponse.data ?? []) as DbCommunityReflectionRow[]
          )
        }

        if (likeResponse.error) {
          if (!isMissingCommunityTableError(likeResponse.error)) {
            logClientError("community.likes.load", likeResponse.error)
          }
        } else {
          ;((likeResponse.data ?? []) as DbCommunityQuestionLikeRow[]).forEach((item) => {
            remoteLikeCounts[item.community_question_id] =
              (remoteLikeCounts[item.community_question_id] ?? 0) + 1

            if (likeActorId && item.user_id === likeActorId) {
              remoteLikedThreadIds.add(item.community_question_id)
            }
          })
        }

        readLegacyResponse(legacyResponse)
      } else if (questionsResponse.error && !isMissingCommunityTableError(questionsResponse.error)) {
        logClientError("community.questions.load", questionsResponse.error)
        remoteErrorMessage = "커뮤니티 질문 일부를 불러오지 못했습니다."
        shouldKeepCachedThreads = true
        readLegacyResponse(await legacyResponsePromise)
      } else {
        readLegacyResponse(await legacyResponsePromise)
      }

      if (cancelled) return

      const mergedThreads = mergeCommunityThreads([
        ...remoteQuestionThreads,
        ...remoteLegacyThreads,
        ...localLegacyThreads,
        ...localThreads,
        ...(shouldKeepCachedThreads ? cachedThreads : []),
      ])

      publishThreads(mergedThreads, remoteLikeCounts, remoteLikedThreadIds, true)

      if (mergedThreads.length > 0) {
        writeCommunityFeedCache(mergedThreads)
      }

      setErrorMessage(remoteErrorMessage)
      } catch (error) {
        if (cancelled) return

        logClientError("community.load", error)
        setErrorMessage("커뮤니티 생각을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadCommunity()

    return () => {
      cancelled = true
    }
  }, [likeActorId, supabase])

  useEffect(() => {
    const sources = Array.from(
      new Set(
        threads
          .map((thread) => thread.source.trim())
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
  }, [sourceTitleOverrides, threads])

  const replaceThread = (thread: CommunityThread, shouldPersistLocally: boolean) => {
    setThreads((currentThreads) =>
      mergeCommunityThreads([thread, ...currentThreads.filter((item) => item.id !== thread.id)])
    )

    if (shouldPersistLocally) {
      upsertCommunityThread(thread)
    }
  }

  const setThreadLikeOptimistically = (threadId: string, liked: boolean) => {
    setLikedThreadIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (liked) {
        nextIds.add(threadId)
      } else {
        nextIds.delete(threadId)
      }

      return nextIds
    })
    setLikeCounts((currentCounts) => ({
      ...currentCounts,
      [threadId]: Math.max(0, (currentCounts[threadId] ?? 0) + (liked ? 1 : -1)),
    }))
  }

  const toggleThreadLike = async (thread: CommunityThread) => {
    if (!likeActorId) {
      setErrorMessage("로그인 후 하트를 누를 수 있습니다.")
      return
    }

    const wasLiked = likedThreadIds.has(thread.id)
    const nextLiked = !wasLiked

    setSavingLikeThreadIds((currentIds) => new Set(currentIds).add(thread.id))
    setThreadLikeOptimistically(thread.id, nextLiked)

    try {
      const shouldUseRemote =
        canUseRemote && Boolean(thread.remoteQuestionId) && !thread.id.startsWith("community-thread")

      if (shouldUseRemote) {
        const response = nextLiked
          ? await supabase.from("community_question_likes").insert({
              community_question_id: thread.remoteQuestionId,
              user_id: likeActorId,
            })
          : await supabase
              .from("community_question_likes")
              .delete()
              .eq("community_question_id", thread.remoteQuestionId)
              .eq("user_id", likeActorId)

        if (response.error) {
          if (isMissingCommunityTableError(response.error)) {
            setCommunityThreadLiked(thread.id, likeActorId, nextLiked)
          } else {
            setThreadLikeOptimistically(thread.id, wasLiked)
            logClientError("community.like.toggle", response.error)
            setErrorMessage("하트를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.")
            return
          }
        }
      } else {
        setCommunityThreadLiked(thread.id, likeActorId, nextLiked)
      }

      setErrorMessage("")
    } finally {
      setSavingLikeThreadIds((currentIds) => {
        const nextIds = new Set(currentIds)

        nextIds.delete(thread.id)
        return nextIds
      })
    }
  }

  const isOwnReflection = (entry: CommunityReflectionEntry) =>
    Boolean(user?.id && (entry.authorId === user.id || ownSharedReflectionIds.has(entry.id)))

  const canDeleteReflection = (entry: CommunityReflectionEntry) =>
    Boolean(user?.id && (isCommunityAdmin || isOwnReflection(entry)))

  const canDeleteThread = (thread: CommunityThread) =>
    Boolean(
      user?.id &&
        (isCommunityAdmin ||
          thread.createdBy === user.id ||
          (!thread.createdBy && thread.reflections.some(isOwnReflection)))
    )

  const isThreadAuthorReflection = (thread: CommunityThread, entry: CommunityReflectionEntry) =>
    Boolean(thread.createdBy && entry.authorId === thread.createdBy)

  const removeReflectionFromView = (threadId: string, reflectionId: string) => {
    setThreads((currentThreads) =>
      currentThreads
        .map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                reflections: thread.reflections.filter((entry) => entry.id !== reflectionId),
                updatedAt: new Date().toISOString(),
              }
            : thread
        )
        .filter((thread) => thread.reflections.length > 0)
    )
  }

  const removeThreadFromView = (threadId: string) => {
    setThreads((currentThreads) => currentThreads.filter((thread) => thread.id !== threadId))
  }

  const clearSavedQuestionShareMarkers = async (reflectionIds: string[]) => {
    if (!user) return
    const reflectionIdSet = new Set(reflectionIds)

    const clearEntries = (personalNote: string | null | undefined) => {
      const entries = readPersonalNoteEntries(personalNote)
      let changed = false
      const nextEntries = entries.map((entry) => {
        if (!entry.communityReflectionId || !reflectionIdSet.has(entry.communityReflectionId)) return entry

        changed = true
        return {
          ...entry,
          communityReflectionId: null,
          communitySharedAt: null,
          communityThreadId: null,
          updatedAt: new Date().toISOString(),
        }
      })

      return changed ? serializePersonalNoteEntries(nextEntries) : null
    }

    const localMeta = readSavedQuestionMeta(user.id)
    let localChanged = false

    Object.keys(localMeta).forEach((key) => {
      const nextPersonalNote = clearEntries(localMeta[key].personalNote)

      if (nextPersonalNote === null) return

      localChanged = true
      localMeta[key] = {
        ...localMeta[key],
        personalNote: nextPersonalNote,
        updatedAt: new Date().toISOString(),
      }
    })

    if (localChanged) {
      writeSavedQuestionMeta(user.id, localMeta)
    }

    if (!canUseRemote) return

    const savedQuestionsResponse = await supabase
      .from("saved_questions")
      .select("id, personal_note")
      .eq("user_id", user.id)
      .limit(200)

    if (savedQuestionsResponse.error) {
      if (!isMissingSavedQuestionColumnError(savedQuestionsResponse.error)) {
        logClientError("community.saved_question_share_marker.load", savedQuestionsResponse.error)
      }
      return
    }

    await Promise.all(
      ((savedQuestionsResponse.data ?? []) as DbSavedQuestionNoteRow[]).map(async (item) => {
        const nextPersonalNote = clearEntries(item.personal_note)

        if (nextPersonalNote === null) return

        const { error } = await supabase
          .from("saved_questions")
          .update({
            personal_note: nextPersonalNote,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id)

        if (error && !isMissingSavedQuestionColumnError(error)) {
          logClientError("community.saved_question_share_marker.update", error)
        }
      })
    )
  }

  const clearSavedQuestionShareMarker = async (reflectionId: string) => {
    await clearSavedQuestionShareMarkers([reflectionId])
  }

  const deleteCommunityReflection = async (thread: CommunityThread, entry: CommunityReflectionEntry) => {
    if (!canDeleteReflection(entry)) return

    setDeletingReflectionIds((currentIds) => new Set(currentIds).add(entry.id))

    try {
      const shouldDeleteRemote = canUseRemote && Boolean(thread.remoteQuestionId) && !isLocalCommunityReflectionId(entry.id)

      if (shouldDeleteRemote) {
        const { error } = await supabase.from("community_reflections").delete().eq("id", entry.id)

        if (error) {
          if (isMissingCommunityTableError(error)) {
            removeCommunityReflection(thread.id, entry.id)
          } else {
            logClientError("community.reflection.delete", error)
            setErrorMessage("내 생각을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.")
            return
          }
        }
      } else {
        removeCommunityReflection(thread.id, entry.id)
      }

      removeReflectionFromView(thread.id, entry.id)
      await clearSavedQuestionShareMarker(entry.id)
      setErrorMessage("")
    } finally {
      setDeletingReflectionIds((currentIds) => {
        const nextIds = new Set(currentIds)

        nextIds.delete(entry.id)
        return nextIds
      })
    }
  }

  const confirmDeleteCommunityReflection = async () => {
    const target = reflectionPendingDeletion

    if (!target) return

    await deleteCommunityReflection(target.thread, target.entry)
    setReflectionPendingDeletion(null)
  }

  const requestDeleteThread = (thread: CommunityThread) => {
    if (!canDeleteThread(thread)) return

    setThreadPendingDeletion(thread)
  }

  const deleteCommunityThread = async () => {
    const thread = threadPendingDeletion

    if (!thread || !canDeleteThread(thread)) return

    const reflectionIds = thread.reflections.map((entry) => entry.id)

    setDeletingThreadIds((currentIds) => new Set(currentIds).add(thread.id))

    try {
      const shouldDeleteRemote =
        canUseRemote && Boolean(thread.remoteQuestionId) && !thread.id.startsWith("community-thread")
      const legacyRemoteSavedQuestionId = getLegacyRemoteSavedQuestionId(thread)
      const shouldDeleteLegacyRemote = canUseRemote && Boolean(legacyRemoteSavedQuestionId)

      if (shouldDeleteRemote) {
        const { error } = await supabase.from("community_questions").delete().eq("id", thread.remoteQuestionId)

        if (error) {
          if (isMissingCommunityTableError(error)) {
            removeCommunityThread(thread.id)
          } else {
            logClientError("community.thread.delete", error)
            setErrorMessage("질문을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.")
            return
          }
        }
      } else if (shouldDeleteLegacyRemote) {
        const { error } = await supabase
          .from("saved_questions")
          .delete()
          .eq("id", legacyRemoteSavedQuestionId)
          .eq("visibility", "community")

        if (error) {
          if (isMissingSavedQuestionColumnError(error)) {
            removeCommunityThread(thread.id)
          } else {
            logClientError("community.legacy_thread.delete", error)
            setErrorMessage("질문을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.")
            return
          }
        }
      } else {
        removeCommunityThread(thread.id)
      }

      removeThreadFromView(thread.id)
      await clearSavedQuestionShareMarkers(reflectionIds)
      setThreadPendingDeletion(null)
      setErrorMessage("")
    } finally {
      setDeletingThreadIds((currentIds) => {
        const nextIds = new Set(currentIds)

        nextIds.delete(thread.id)
        return nextIds
      })
    }
  }

  const insertRemoteQuestion = async (thread: Pick<CommunityThread, "source" | "summary" | "question">) => {
    if (!user) throw new Error("User is required")

    const questionResponse = await supabase
      .from("community_questions")
      .insert({
        source: thread.source,
        summary: thread.summary,
        question: thread.question,
        created_by: user.id,
      })
      .select("id, created_by, source, summary, question, created_at, updated_at")
      .single()

    if (questionResponse.error) throw questionResponse.error

    return questionResponse.data as DbCommunityQuestionRow
  }

  const insertRemoteReflection = async (communityQuestionId: string, text: string) => {
    if (!user) throw new Error("User is required")

    const reflectionResponse = await supabase
      .from("community_reflections")
      .insert({
        community_question_id: communityQuestionId,
        user_id: user.id,
        body: text,
      })
      .select("id, community_question_id, user_id, body, created_at, updated_at")
      .single()

    if (reflectionResponse.error) throw reflectionResponse.error

    const entry = reflectionResponse.data as DbCommunityReflectionRow

    return {
      id: entry.id,
      text: entry.body,
      authorLabel: "내 생각",
      authorId: entry.user_id ?? user.id,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    } satisfies CommunityReflectionEntry
  }

  const handleAddReflection = async (thread: CommunityThread) => {
    const draft = reflectionDrafts[thread.id]?.trim() ?? ""

    if (!draft) return

    if (!user && process.env.NODE_ENV !== "development") {
      setShowLoginRequiredModal(true)
      return
    }

    setSavingReflectionIds((currentIds) => new Set(currentIds).add(thread.id))

    try {
      let reflection: CommunityReflectionEntry | null = null
      let remoteQuestionId = thread.remoteQuestionId
      let shouldPersistLocally = true

      if (canUseRemote) {
        try {
          if (!remoteQuestionId) {
            const remoteQuestion = await insertRemoteQuestion(thread)

            remoteQuestionId = remoteQuestion.id
          }

          reflection = await insertRemoteReflection(remoteQuestionId, draft)
          shouldPersistLocally = false
          setErrorMessage("")
        } catch (error) {
          if (!isMissingCommunityTableError(error)) {
            logClientError("community.reflection.create", error)
          }

          setErrorMessage("커뮤니티 테이블이 아직 준비되지 않아 이 기기에서만 보이도록 저장했습니다.")
        }
      }

      if (!reflection) {
        const now = new Date().toISOString()

        reflection = {
          id: createCommunityId("community-reflection"),
          text: draft,
          authorLabel: "내 생각",
          authorId: user?.id ?? null,
          createdAt: now,
          updatedAt: now,
        }
      }

      const nextThread: CommunityThread = {
        ...thread,
        remoteQuestionId,
        reflections: [...thread.reflections, reflection],
        updatedAt: reflection.updatedAt,
      }

      replaceThread(nextThread, shouldPersistLocally)
      setReflectionDrafts((currentDrafts) => ({
        ...currentDrafts,
        [thread.id]: "",
      }))
      gtag.communityReflectionCreate({
        existing_reflection_count: thread.reflections.length,
        local_fallback: shouldPersistLocally,
        reflection_length: draft.length,
        signed_in: Boolean(user),
      })
    } finally {
      setSavingReflectionIds((currentIds) => {
        const nextIds = new Set(currentIds)

        nextIds.delete(thread.id)
        return nextIds
      })
    }
  }

  const toggleSummary = (threadId: string) => {
    setOpenSummaryIds((currentIds) => {
      const nextIds = new Set(currentIds)

      if (nextIds.has(threadId)) {
        nextIds.delete(threadId)
      } else {
        nextIds.add(threadId)
      }

      return nextIds
    })
  }

  const visibleThreads = showMineOnly
    ? threads
        .map((thread) => ({
          ...thread,
          reflections: thread.reflections.filter(isOwnReflection),
        }))
        .filter((thread) => thread.reflections.length > 0)
    : threads
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

  return (
    <main className="min-h-screen bg-[#120b07] text-[#f5dfbd]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_25%_16%,rgba(217,173,115,0.15),transparent_34%),radial-gradient(circle_at_75%_36%,rgba(82,111,87,0.18),transparent_34%),#120b07]" />
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
      <nav className="fixed right-4 top-4 z-20 flex items-center gap-2">
        {user ? (
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
        ) : (
          <Link
            href="/auth"
            className="inline-flex h-10 items-center border border-[#d9ad73]/25 bg-[#f5dfbd]/[0.08] px-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#f5dfbd]/60 shadow-[0_10px_30px_rgba(13,8,5,0.32)] backdrop-blur-md transition-colors duration-500 hover:border-[#d9ad73]/55 hover:text-[#f5dfbd]/90 focus:outline-none"
          >
            Login
          </Link>
        )}
      </nav>

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 pb-24 pt-32 sm:px-8 sm:pt-36">
        <header className="border-b border-[#d9ad73]/15 pb-8">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#d2ad7c]/50">
            Community
          </p>
          <h1 className="mt-3 text-3xl font-medium leading-tight text-[#f5dfbd]/90 sm:text-4xl">
            함께 나누는 질문과 생각
          </h1>
          <div className="mt-4 flex max-w-3xl flex-col gap-1.5 text-sm font-medium leading-[1.4] text-[#f5dfbd]/52 [word-break:keep-all]">
            <p>
              타인의 질문과 생각에 내 답변을 더해보세요. 같은 질문 아래에 쌓이는 다양한 생각들을 통해{" "}
              <span className="sm:whitespace-nowrap">새로운 시각을 발견할 수 있습니다.</span>
            </p>
            <p>
              건강한 사유를 공유하는 공간입니다. 부적절한 게시물은 운영 정책에 따라 삭제될 수 있습니다.
            </p>
          </div>
        </header>

        {errorMessage && (
          <div className="mt-6 border border-[#d9ad73]/25 bg-[#f5dfbd]/[0.06] px-4 py-3">
            <p className="text-sm font-medium leading-[1.6] text-[#f5dfbd]/68">{errorMessage}</p>
          </div>
        )}

        <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="커뮤니티 기능 안내">
          <div className="border-l border-[#d9ad73]/18 pl-3">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-[#d2ad7c]/58 [word-spacing:-0.28em]">
              주제 요약
            </p>
            <p className="mt-2 text-xs font-medium leading-[1.65] text-[#f5dfbd]/44 [word-break:keep-all]">
              카드 상단 주제를 누르면 요약이 펼쳐집니다.
            </p>
          </div>
          <div className="border-l border-[#d9ad73]/18 pl-3">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.12em] text-[#d2ad7c]/58 [word-spacing:-0.28em]">
              생각 더하기
            </p>
            <p className="mt-2 text-xs font-medium leading-[1.65] text-[#f5dfbd]/44 [word-break:keep-all]">
              같은 질문 아래에 내 생각을 이어 남길 수 있습니다.
            </p>
          </div>
        </section>

        <div className="mt-10 flex justify-end">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border border-[#d9ad73]/18 bg-[#f5dfbd]/[0.04] p-1">
            <button
              type="button"
              onClick={() => setShowMineOnly(false)}
              className={`px-3.5 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] transition-colors duration-300 focus:outline-none ${
                showMineOnly
                  ? "text-[#f5dfbd]/38 hover:text-[#f5dfbd]/68"
                  : "bg-[#f5dfbd]/[0.08] text-[#f5dfbd]/76"
              }`}
            >
              전체
            </button>
            <button
              type="button"
              onClick={() => setShowMineOnly(true)}
              disabled={!user}
              className={`px-3.5 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] transition-colors duration-300 focus:outline-none disabled:cursor-not-allowed disabled:text-[#f5dfbd]/24 ${
                showMineOnly
                  ? "bg-[#f5dfbd]/[0.08] text-[#f5dfbd]/76"
                  : "text-[#f5dfbd]/38 hover:text-[#f5dfbd]/68"
              }`}
            >
              내 글 보기
            </button>
            </div>
          </div>
        </div>

        <section className="mt-4 grid min-w-0 grid-cols-1 items-start gap-5 pb-16 lg:grid-cols-2">
          {loading ? (
            <div className="border border-[#d9ad73]/15 bg-[#f5dfbd]/[0.04] p-8 text-center lg:col-span-2">
              <p className="text-sm font-medium text-[#f5dfbd]/48">커뮤니티 생각을 불러오고 있습니다.</p>
            </div>
          ) : visibleThreads.length === 0 ? (
            <div className="border border-[#d9ad73]/15 bg-[#f5dfbd]/[0.04] p-8 text-center lg:col-span-2">
              <p className="text-sm font-medium text-[#f5dfbd]/48">
                {showMineOnly ? "내가 공유한 생각이 없습니다." : "아직 남겨진 생각이 없습니다."}
              </p>
            </div>
          ) : (
            visibleThreads.map((thread) => {
              const sourceThread = threads.find((item) => item.id === thread.id) ?? thread
              const summaryOpen = openSummaryIds.has(thread.id)
              const sourceTitle = getSourceTitle(thread.source, sourceTitleOverrides)
              const sourceUrl = getSourceUrl(thread.source)
              const draft = reflectionDrafts[thread.id] ?? ""
              const savingReflection = savingReflectionIds.has(thread.id)
              const threadCanDelete = canDeleteThread(sourceThread)
              const communityAuthorLabels = getCommunityAuthorLabels(thread.reflections, (entry) =>
                isThreadAuthorReflection(thread, entry)
              )

              return (
                <article
                  key={thread.id}
                  className="w-full min-w-0 border border-[#d9ad73]/18 bg-[#120b07]/55 px-5 pb-5 pt-5 shadow-[0_18px_50px_rgba(13,8,5,0.34)] backdrop-blur-xl"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {thread.summary.trim() ? (
                        <button
                          type="button"
                          onClick={() => toggleSummary(thread.id)}
                          title="요약 보기"
                          className="block max-w-full -translate-y-[1.5px] truncate text-left font-mono text-xs font-medium leading-none tracking-[0.12em] text-[#d2ad7c]/46 underline-offset-4 transition-colors duration-300 hover:text-[#f5dfbd]/72 hover:underline focus:outline-none"
                        >
                          {sourceTitle}
                        </button>
                      ) : (
                        <p className="max-w-full -translate-y-[1.5px] truncate font-mono text-xs font-medium leading-none tracking-[0.12em] text-[#d2ad7c]/42">
                          {sourceTitle}
                        </p>
                      )}
                      {sourceUrl && <SourceLink href={sourceUrl} />}
                    </div>
                    <div className="flex shrink-0 items-start gap-3">
                      <time className="font-mono text-[10px] leading-none text-[#f5dfbd]/32">
                        {formatDate(thread.updatedAt)}
                      </time>
                      {threadCanDelete && (
                        <button
                          type="button"
                          onClick={() => requestDeleteThread(sourceThread)}
                          disabled={deletingThreadIds.has(sourceThread.id)}
                          aria-label="질문 삭제"
                          className="flex h-[15px] w-[15px] items-center justify-center text-[#d2ad7c]/42 transition-colors duration-300 hover:text-[#f5dfbd]/78 focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          <TrashIcon className="h-[15px] w-[13px] -translate-y-[3px]" />
                        </button>
                      )}
                    </div>
                  </div>

                  {summaryOpen && thread.summary.trim() && (
                    <SummaryText
                      className="mb-4 border-t border-[#d9ad73]/12 pt-4 text-[13px] font-medium leading-[1.75] text-[#f5dfbd]/50 [overflow-wrap:anywhere] [word-break:keep-all]"
                      summary={thread.summary}
                    />
                  )}

                  <p className="text-base font-medium leading-[1.68] text-[#f5dfbd]/86 [overflow-wrap:anywhere] [word-break:keep-all]">
                    {thread.question}
                  </p>

                  {thread.reflections.length > 0 && (
                    <div className="mt-4 border-t border-[#d9ad73]/12 pt-4">
                      <div className="flex flex-col">
                        {thread.reflections.map((entry, entryIndex) => {
                          const authorLabel = isThreadAuthorReflection(thread, entry)
                            ? "작성자"
                            : communityAuthorLabels.get(getAnonymousAuthorKey(entry)) ?? "타인 01"

                          return (
                            <article
                              key={entry.id}
                              className={entryIndex === 0 ? "pb-4" : "border-t border-[#d9ad73]/12 py-4"}
                            >
                              <div className="flex items-start gap-4">
                                <div className="min-w-0 flex-1">
                                  <p className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#d2ad7c]/45">
                                    {authorLabel}
                                  </p>
                                  <p className="whitespace-pre-line text-sm font-medium leading-[1.75] text-[#f5dfbd]/68 [overflow-wrap:anywhere] [word-break:keep-all]">
                                    {entry.text}
                                  </p>
                                </div>
                                {canDeleteReflection(entry) && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setReflectionPendingDeletion({
                                        entry,
                                        thread: sourceThread,
                                      })
                                    }
                                    disabled={deletingReflectionIds.has(entry.id)}
                                    aria-label={isOwnReflection(entry) ? "내 생각 삭제" : "생각 삭제"}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center text-[#d2ad7c]/42 transition-colors duration-300 hover:text-[#f5dfbd]/78 focus:outline-none disabled:cursor-not-allowed disabled:opacity-45"
                                  >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            </article>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  <div className={thread.reflections.length > 0 ? "mt-1" : "mt-4 border-t border-[#d9ad73]/12 pt-4"}>
                    <textarea
                      value={draft}
                      onChange={(event) =>
                        setReflectionDrafts((currentDrafts) => ({
                          ...currentDrafts,
                          [thread.id]: event.target.value.slice(0, reflectionMaxLength),
                        }))
                      }
                      maxLength={reflectionMaxLength}
                      rows={3}
                      placeholder="이 질문에 생각을 더해보세요."
                      className="min-h-24 w-full resize-none border border-[#d9ad73]/16 bg-[#080403]/28 px-3 py-3 text-base font-medium leading-[1.7] text-[#f5dfbd]/78 outline-none transition-colors duration-300 placeholder:text-[#d2ad7c]/34 focus:border-[#d9ad73]/42 sm:text-sm"
                    />
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <button
                        type="button"
                        onClick={() => toggleThreadLike(sourceThread)}
                        disabled={savingLikeThreadIds.has(sourceThread.id)}
                        aria-label={likedThreadIds.has(sourceThread.id) ? "하트 취소" : "하트 누르기"}
                        aria-pressed={likedThreadIds.has(sourceThread.id)}
                        className={`flex h-9 min-w-14 items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.12em] transition-colors duration-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-45 ${
                          likedThreadIds.has(sourceThread.id)
                            ? "text-[#efd3a2]/78 hover:text-[#fff4dc]"
                            : "text-[#d2ad7c]/42 hover:text-[#f5dfbd]/78"
                        }`}
                      >
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill={likedThreadIds.has(sourceThread.id) ? "currentColor" : "none"}
                          aria-hidden="true"
                          className="shrink-0"
                        >
                          <path
                            d="M20.84 4.61C19.76 3.53 18.3 2.93 16.77 2.93C15.24 2.93 13.78 3.53 12.7 4.61L12 5.31L11.3 4.61C10.22 3.53 8.76 2.93 7.23 2.93C5.7 2.93 4.24 3.53 3.16 4.61C0.91 6.86 0.91 10.51 3.16 12.76L12 21.6L20.84 12.76C23.09 10.51 23.09 6.86 20.84 4.61Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span className="tabular-nums">{likeCounts[sourceThread.id] ?? 0}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddReflection(thread)}
                        disabled={!draft.trim() || savingReflection}
                        className="rounded-full border border-[#d9ad73]/26 bg-[#f5dfbd]/[0.07] px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-[#f5dfbd]/66 transition-colors duration-300 hover:border-[#efd3a2]/52 hover:bg-[#f5dfbd]/[0.12] hover:text-[#fff4dc] disabled:cursor-not-allowed disabled:border-[#d9ad73]/12 disabled:text-[#f5dfbd]/28"
                      >
                        추가
                      </button>
                    </div>
                  </div>
                </article>
              )
            })
          )}
        </section>
      </div>
      {threadPendingDeletion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#080403]/70 px-5 backdrop-blur-md"
          role="presentation"
          onClick={() => setThreadPendingDeletion(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-delete-thread-title"
            className="w-full max-w-sm border border-[#d9ad73]/24 bg-[#120b07]/95 p-6 shadow-[0_24px_80px_rgba(13,8,5,0.72)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              id="community-delete-thread-title"
              className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#d2ad7c]/55"
            >
              질문 삭제
            </p>
            <p className="mt-4 text-sm font-medium leading-[1.75] text-[#f5dfbd]/72 [word-break:keep-all]">
              {threadPendingDeletion.reflections.some((entry) => !isOwnReflection(entry))
                ? `삭제 시 함께 달린 ${threadPendingDeletion.reflections.length}개의 생각도 모두 사라집니다. 정말 삭제하시겠습니까?`
                : "이 질문을 삭제하면 연결된 생각도 함께 사라집니다. 정말 삭제하시겠습니까?"}
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setThreadPendingDeletion(null)}
                className="border border-[#d9ad73]/18 bg-[#f5dfbd]/[0.04] px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#f5dfbd]/46 transition-colors duration-300 hover:text-[#f5dfbd]/72 focus:outline-none"
              >
                취소
              </button>
              <button
                type="button"
                onClick={deleteCommunityThread}
                disabled={deletingThreadIds.has(threadPendingDeletion.id)}
                className="border border-[#d9ad73]/30 bg-[#f5dfbd]/[0.08] px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#f5dfbd]/76 transition-colors duration-300 hover:border-[#efd3a2]/52 hover:text-[#fff4dc] focus:outline-none disabled:cursor-not-allowed disabled:text-[#f5dfbd]/30"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
      {reflectionPendingDeletion && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#080403]/70 px-5 backdrop-blur-md"
          role="presentation"
          onClick={() => setReflectionPendingDeletion(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-delete-reflection-title"
            className="w-full max-w-sm border border-[#d9ad73]/24 bg-[#120b07]/95 p-6 shadow-[0_24px_80px_rgba(13,8,5,0.72)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              id="community-delete-reflection-title"
              className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#d2ad7c]/55"
            >
              생각 삭제
            </p>
            <p className="mt-4 text-sm font-medium leading-[1.75] text-[#f5dfbd]/72 [word-break:keep-all]">
              이 생각을 정말 삭제하시겠습니까?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReflectionPendingDeletion(null)}
                className="border border-[#d9ad73]/18 bg-[#f5dfbd]/[0.04] px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#f5dfbd]/46 transition-colors duration-300 hover:text-[#f5dfbd]/72 focus:outline-none"
              >
                취소
              </button>
              <button
                type="button"
                onClick={confirmDeleteCommunityReflection}
                disabled={deletingReflectionIds.has(reflectionPendingDeletion.entry.id)}
                className="border border-[#d9ad73]/30 bg-[#8d4f31]/18 px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#efd3a2]/78 transition-colors duration-300 hover:border-[#efd3a2]/52 hover:bg-[#8d4f31]/28 hover:text-[#fff4dc] focus:outline-none disabled:cursor-not-allowed disabled:text-[#f5dfbd]/30"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
      {showLoginRequiredModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#080403]/70 px-5 backdrop-blur-md"
          role="presentation"
          onClick={() => setShowLoginRequiredModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-login-required-title"
            className="w-full max-w-sm border border-[#d9ad73]/24 bg-[#120b07]/95 p-6 shadow-[0_24px_80px_rgba(13,8,5,0.72)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              id="community-login-required-title"
              className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#d2ad7c]/55"
            >
              로그인이 필요합니다
            </p>
            <p className="mt-4 text-sm font-medium leading-[1.75] text-[#f5dfbd]/72 [word-break:keep-all]">
              커뮤니티에 생각을 남기려면 먼저 로그인해 주세요.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowLoginRequiredModal(false)}
                className="border border-[#d9ad73]/18 bg-[#f5dfbd]/[0.04] px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#f5dfbd]/46 transition-colors duration-300 hover:text-[#f5dfbd]/72 focus:outline-none"
              >
                닫기
              </button>
              <Link
                href="/auth"
                className="border border-[#d9ad73]/30 bg-[#f5dfbd]/[0.08] px-4 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-[#f5dfbd]/76 transition-colors duration-300 hover:border-[#efd3a2]/52 hover:text-[#fff4dc] focus:outline-none"
              >
                로그인
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
