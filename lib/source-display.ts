const sourceTitleRequests = new Map<string, Promise<string | null>>()

export function getYouTubeVideoId(source: string) {
  try {
    const url = new URL(source)
    const hostname = url.hostname.replace(/^www\./, "")

    if (hostname === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? null
    }

    if (hostname === "youtube.com" || hostname.endsWith(".youtube.com")) {
      if (url.pathname === "/watch") return url.searchParams.get("v")
      if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
        return url.pathname.split("/").filter(Boolean)[1] ?? null
      }
    }
  } catch {}

  return null
}

export function isYouTubeSource(source: string) {
  return Boolean(getYouTubeVideoId(source))
}

export function isSourceTitleFetchable(source: string) {
  try {
    const url = new URL(source)

    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export function getSourceDisplayTitle(source: string, fetchedTitle?: string | null) {
  const title = fetchedTitle?.trim()
  if (title) return title

  try {
    const url = new URL(source)

    if (getYouTubeVideoId(source)) return "YouTube"
    return url.hostname.replace(/^www\./, "")
  } catch {
    return source || "직접 작성한 질문"
  }
}

export function fetchSourceDisplayTitle(source: string) {
  if (!isSourceTitleFetchable(source)) return Promise.resolve(null)

  const cachedRequest = sourceTitleRequests.get(source)
  if (cachedRequest) return cachedRequest

  const request = fetch(`/api/source-title?source=${encodeURIComponent(source)}`)
    .then(async (response) => {
      if (!response.ok) return null

      const payload: unknown = await response.json()
      if (!payload || typeof payload !== "object") return null

      const title = (payload as { displayTitle?: unknown }).displayTitle
      return typeof title === "string" && title.trim() ? title.trim() : null
    })
    .catch(() => null)

  sourceTitleRequests.set(source, request)
  return request
}
