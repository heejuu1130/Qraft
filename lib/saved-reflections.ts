export type ReflectionVisibility = "private" | "link" | "community"

export type SavedQuestionLocalMeta = {
  id: string
  source: string
  summary: string
  question: string
  questionIndex: number
  reflection: string
  personalNote: string
  visibility: ReflectionVisibility
  savedAt: string
  updatedAt: string
  sharedAt: string | null
}

export type PersonalNoteEntry = {
  id: string
  text: string
  createdAt: string
  updatedAt: string
  communitySharedAt?: string | null
  communityThreadId?: string | null
  communityReflectionId?: string | null
}

export const savedQuestionMetaStoragePrefix = "qraft:saved-question-meta:"
const personalNoteEntriesPrefix = "qraft-personal-note-entries:v1:"

function isPersonalNoteEntry(value: unknown): value is PersonalNoteEntry {
  if (!value || typeof value !== "object") return false

  const item = value as Record<string, unknown>

  return (
    typeof item.id === "string" &&
    typeof item.text === "string" &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string" &&
    (item.communitySharedAt === undefined ||
      item.communitySharedAt === null ||
      typeof item.communitySharedAt === "string") &&
    (item.communityThreadId === undefined ||
      item.communityThreadId === null ||
      typeof item.communityThreadId === "string") &&
    (item.communityReflectionId === undefined ||
      item.communityReflectionId === null ||
      typeof item.communityReflectionId === "string")
  )
}

export function readPersonalNoteEntries(value: string | null | undefined): PersonalNoteEntry[] {
  const note = value ?? ""
  const trimmedNote = note.trim()

  if (!trimmedNote) return []

  if (!note.startsWith(personalNoteEntriesPrefix)) {
    return [
      {
        id: "legacy",
        text: trimmedNote,
        createdAt: "",
        updatedAt: "",
      },
    ]
  }

  try {
    const parsed = JSON.parse(note.slice(personalNoteEntriesPrefix.length))

    if (!Array.isArray(parsed)) return []

    return parsed
      .filter(isPersonalNoteEntry)
      .map((item) => ({
        ...item,
        text: item.text.trim(),
      }))
      .filter((item) => item.text.length > 0)
  } catch {
    return []
  }
}

export function serializePersonalNoteEntries(entries: PersonalNoteEntry[]) {
  const cleanEntries = entries
    .map((item) => ({
      ...item,
      text: item.text.trim(),
    }))
    .filter((item) => item.text.length > 0)

  if (cleanEntries.length === 0) return ""

  return `${personalNoteEntriesPrefix}${JSON.stringify(cleanEntries)}`
}

export function getPersonalNoteText(value: string | null | undefined) {
  return readPersonalNoteEntries(value)
    .map((item) => item.text)
    .join("\n\n")
}

export function normalizeReflectionVisibility(value: unknown): ReflectionVisibility {
  return value === "link" || value === "community" ? value : "private"
}

export function getSavedQuestionMetaStorageKey(userId?: string | null) {
  return `${savedQuestionMetaStoragePrefix}${userId ?? "guest"}`
}

function isSavedQuestionLocalMeta(value: unknown): value is SavedQuestionLocalMeta {
  if (!value || typeof value !== "object") return false

  const item = value as Record<string, unknown>

  return (
    typeof item.id === "string" &&
    typeof item.source === "string" &&
    typeof item.summary === "string" &&
    typeof item.question === "string" &&
    typeof item.questionIndex === "number" &&
    typeof item.reflection === "string" &&
    typeof item.personalNote === "string" &&
    normalizeReflectionVisibility(item.visibility) === item.visibility &&
    typeof item.savedAt === "string" &&
    typeof item.updatedAt === "string" &&
    (item.sharedAt === null || typeof item.sharedAt === "string")
  )
}

export function readSavedQuestionMeta(userId?: string | null): Record<string, SavedQuestionLocalMeta> {
  if (typeof window === "undefined") return {}

  try {
    const raw = window.localStorage.getItem(getSavedQuestionMetaStorageKey(userId))
    if (!raw) return {}

    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, SavedQuestionLocalMeta] =>
        typeof entry[0] === "string" && isSavedQuestionLocalMeta(entry[1])
      )
    )
  } catch {
    return {}
  }
}

export function writeSavedQuestionMeta(
  userId: string | null | undefined,
  meta: Record<string, SavedQuestionLocalMeta>
) {
  if (typeof window === "undefined") return

  try {
    window.localStorage.setItem(getSavedQuestionMetaStorageKey(userId), JSON.stringify(meta))
  } catch {}
}

export function upsertSavedQuestionMeta(userId: string | null | undefined, item: SavedQuestionLocalMeta) {
  const meta = readSavedQuestionMeta(userId)

  meta[item.id] = item
  writeSavedQuestionMeta(userId, meta)
}

export function removeSavedQuestionMeta(userId: string | null | undefined, id: string) {
  const meta = readSavedQuestionMeta(userId)

  delete meta[id]
  writeSavedQuestionMeta(userId, meta)
}

export function readCommunityReflectionMeta() {
  if (typeof window === "undefined") return []

  const items: SavedQuestionLocalMeta[] = []

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key?.startsWith(savedQuestionMetaStoragePrefix)) continue

      const raw = window.localStorage.getItem(key)
      if (!raw) continue

      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object") continue

      Object.values(parsed).forEach((value) => {
        if (isSavedQuestionLocalMeta(value) && value.visibility === "community") {
          items.push(value)
        }
      })
    }
  } catch {}

  return items.sort((a, b) => {
    const aTime = new Date(a.sharedAt ?? a.updatedAt).getTime()
    const bTime = new Date(b.sharedAt ?? b.updatedAt).getTime()

    return bTime - aTime
  })
}

export function isMissingSavedQuestionColumnError(error: unknown) {
  const text = JSON.stringify(error).toLowerCase()

  return ["reflection", "personal_note", "visibility", "shared_at", "updated_at"].some((column) =>
    text.includes(column)
  )
}
