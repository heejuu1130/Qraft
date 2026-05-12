export type CommunityReflectionEntry = {
  id: string
  text: string
  authorLabel: string
  authorId?: string | null
  createdAt: string
  updatedAt: string
}

export type CommunityThread = {
  id: string
  remoteQuestionId: string | null
  createdBy?: string | null
  source: string
  summary: string
  question: string
  reflections: CommunityReflectionEntry[]
  createdAt: string
  updatedAt: string
}

const communityThreadsStorageKey = "qraft:community-threads:v1"
const communityThreadLikesStorageKey = "qraft:community-thread-likes:v1"
const communityFeedCacheStorageKey = "qraft:community-feed-cache:v1"

const getCommunityThreadKey = (thread: Pick<CommunityThread, "source" | "question">) =>
  `${thread.source.trim().toLowerCase()}::${thread.question.trim().toLowerCase()}`

const getTime = (value: string) => {
  const time = new Date(value).getTime()

  return Number.isFinite(time) ? time : 0
}

export function createCommunityId(prefix = "community") {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isCommunityReflectionEntry(value: unknown): value is CommunityReflectionEntry {
  if (!value || typeof value !== "object") return false

  const item = value as Record<string, unknown>

  return (
    typeof item.id === "string" &&
    typeof item.text === "string" &&
    typeof item.authorLabel === "string" &&
    (item.authorId === undefined || item.authorId === null || typeof item.authorId === "string") &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  )
}

function isCommunityThread(value: unknown): value is CommunityThread {
  if (!value || typeof value !== "object") return false

  const item = value as Record<string, unknown>

  return (
    typeof item.id === "string" &&
    (item.remoteQuestionId === null || typeof item.remoteQuestionId === "string") &&
    (item.createdBy === undefined || item.createdBy === null || typeof item.createdBy === "string") &&
    typeof item.source === "string" &&
    typeof item.summary === "string" &&
    typeof item.question === "string" &&
    Array.isArray(item.reflections) &&
    item.reflections.every(isCommunityReflectionEntry) &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  )
}

export function readCommunityFeedCache(): CommunityThread[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(communityFeedCacheStorageKey)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(isCommunityThread)
  } catch {
    return []
  }
}

export function writeCommunityFeedCache(threads: CommunityThread[]) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(communityFeedCacheStorageKey, JSON.stringify(threads.slice(0, 80)))
  } catch {}
}

export function readCommunityThreads(): CommunityThread[] {
  if (typeof window === "undefined") return []

  try {
    const raw = window.localStorage.getItem(communityThreadsStorageKey)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed.filter(isCommunityThread)
  } catch {
    return []
  }
}

export function writeCommunityThreads(threads: CommunityThread[]) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(communityThreadsStorageKey, JSON.stringify(threads))
  } catch {}
}

function isCommunityThreadLikes(value: unknown): value is Record<string, string[]> {
  if (!value || typeof value !== "object") return false

  return Object.values(value).every(
    (item) => Array.isArray(item) && item.every((userId) => typeof userId === "string")
  )
}

export function readCommunityThreadLikes() {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(communityThreadLikesStorageKey)
    if (!raw) return {}

    const parsed = JSON.parse(raw)

    return isCommunityThreadLikes(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function writeCommunityThreadLikes(likes: Record<string, string[]>) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(communityThreadLikesStorageKey, JSON.stringify(likes))
  } catch {}
}

export function setCommunityThreadLiked(threadId: string, userId: string, liked: boolean) {
  const likes = readCommunityThreadLikes()
  const likedBy = new Set(likes[threadId] ?? [])

  if (liked) {
    likedBy.add(userId)
  } else {
    likedBy.delete(userId)
  }

  const nextLikedBy = Array.from(likedBy)

  if (nextLikedBy.length > 0) {
    likes[threadId] = nextLikedBy
  } else {
    delete likes[threadId]
  }

  writeCommunityThreadLikes(likes)
}

export function upsertCommunityThread(thread: CommunityThread) {
  const threads = readCommunityThreads()
  const existingIndex = threads.findIndex((item) => item.id === thread.id)

  if (existingIndex >= 0) {
    threads[existingIndex] = thread
  } else {
    threads.unshift(thread)
  }

  writeCommunityThreads(threads)
}

export function upsertCommunityThreadByQuestion(thread: CommunityThread) {
  const threads = readCommunityThreads()
  const threadKey = getCommunityThreadKey(thread)
  const existingIndex = threads.findIndex((item) => getCommunityThreadKey(item) === threadKey)

  if (existingIndex < 0) {
    writeCommunityThreads([thread, ...threads])
    return thread
  }

  const existingThread = threads[existingIndex]
  const reflections = new Map<string, CommunityReflectionEntry>()

  existingThread.reflections.forEach((entry) => {
    reflections.set(entry.id, entry)
  })
  thread.reflections.forEach((entry) => {
    reflections.set(entry.id, entry)
  })

  const nextThread: CommunityThread = {
    ...existingThread,
    remoteQuestionId: existingThread.remoteQuestionId ?? thread.remoteQuestionId,
    createdBy: existingThread.createdBy ?? thread.createdBy ?? null,
    source: existingThread.source || thread.source,
    summary: existingThread.summary || thread.summary,
    updatedAt:
      getTime(existingThread.updatedAt) >= getTime(thread.updatedAt)
        ? existingThread.updatedAt
        : thread.updatedAt,
    reflections: Array.from(reflections.values()).sort(
      (a, b) => getTime(a.createdAt) - getTime(b.createdAt)
    ),
  }

  threads[existingIndex] = nextThread
  writeCommunityThreads(threads)

  return nextThread
}

export function removeCommunityThread(threadId: string | null | undefined) {
  if (!threadId) return

  writeCommunityThreads(readCommunityThreads().filter((thread) => thread.id !== threadId))

  const likes = readCommunityThreadLikes()
  delete likes[threadId]
  writeCommunityThreadLikes(likes)
}

export function removeCommunityReflection(threadId: string | null | undefined, reflectionId: string | null | undefined) {
  if (!reflectionId) return

  const threads = readCommunityThreads()
    .map((thread) =>
      !threadId || thread.id === threadId || thread.reflections.some((entry) => entry.id === reflectionId)
        ? {
            ...thread,
            reflections: thread.reflections.filter((entry) => entry.id !== reflectionId),
            updatedAt: new Date().toISOString(),
          }
        : thread
    )
    .filter((thread) => thread.reflections.length > 0)

  writeCommunityThreads(threads)
}
