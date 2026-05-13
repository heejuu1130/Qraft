import { NextResponse } from "next/server"

const sourceTitleTimeoutMs = 5000
const maxHtmlBytes = 256_000
const maxTitleLength = 120

function getYouTubeVideoId(source: string) {
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

function isBlockedHost(hostname: string) {
  const normalizedHost = hostname.toLowerCase()

  return (
    normalizedHost === "localhost" ||
    normalizedHost.endsWith(".localhost") ||
    normalizedHost.endsWith(".local") ||
    normalizedHost === "0.0.0.0" ||
    normalizedHost === "127.0.0.1" ||
    normalizedHost === "::1" ||
    /^10\./.test(normalizedHost) ||
    /^192\.168\./.test(normalizedHost) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(normalizedHost)
  )
}

function cleanTitle(title: string) {
  return title
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim()
    .slice(0, maxTitleLength)
}

function extractMetaTitle(html: string) {
  const candidates = [
    /<meta\s+[^>]*(?:property|name)=["']og:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']og:title["'][^>]*>/i,
    /<meta\s+[^>]*(?:property|name)=["']twitter:title["'][^>]*content=["']([^"']+)["'][^>]*>/i,
    /<meta\s+[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']twitter:title["'][^>]*>/i,
    /<title[^>]*>([\s\S]*?)<\/title>/i,
  ]

  for (const pattern of candidates) {
    const match = html.match(pattern)
    const title = match?.[1] ? cleanTitle(match[1]) : ""

    if (title) return title
  }

  return ""
}

function getFallbackTitle(source: string) {
  try {
    const url = new URL(source)

    return url.hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

async function fetchArticleTitle(source: string) {
  const response = await fetch(source, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0 (compatible; Qraft/1.0; +https://qraft.app)",
    },
    signal: AbortSignal.timeout(sourceTitleTimeoutMs),
  })

  if (!response.ok) return ""

  const html = await readLimitedText(response, maxHtmlBytes)
  return extractMetaTitle(html)
}

async function readLimitedText(response: Response, maxBytes: number) {
  if (!response.body) return response.text()

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let receivedBytes = 0
  let text = ""

  while (receivedBytes < maxBytes) {
    const { done, value } = await reader.read()

    if (done) break

    const remainingBytes = maxBytes - receivedBytes
    const chunk = value.byteLength > remainingBytes ? value.slice(0, remainingBytes) : value

    receivedBytes += chunk.byteLength
    text += decoder.decode(chunk, { stream: receivedBytes < maxBytes })

    if (value.byteLength > remainingBytes) {
      await reader.cancel()
      break
    }
  }

  return text + decoder.decode()
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get("source")?.trim() ?? ""
  const videoId = getYouTubeVideoId(source)
  let sourceUrl: URL

  try {
    sourceUrl = new URL(source)
  } catch {
    return NextResponse.json({ displayTitle: null }, { status: 400 })
  }

  if (!["http:", "https:"].includes(sourceUrl.protocol) || isBlockedHost(sourceUrl.hostname)) {
    return NextResponse.json({ displayTitle: null }, { status: 400 })
  }

  try {
    if (!videoId) {
      const title = await fetchArticleTitle(source)

      return NextResponse.json(
        { displayTitle: title ? `News: ${title}` : getFallbackTitle(source) },
        {
          headers: {
            "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
          },
        }
      )
    }

    const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`
    const response = await fetch(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonicalUrl)}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(sourceTitleTimeoutMs),
      }
    )

    if (!response.ok) {
      return NextResponse.json({ displayTitle: "YouTube" })
    }

    const payload: unknown = await response.json()
    const title =
      payload && typeof payload === "object" && typeof (payload as { title?: unknown }).title === "string"
        ? (payload as { title: string }).title.trim()
        : ""

    return NextResponse.json(
      { displayTitle: title ? `YouTube: ${title}` : "YouTube" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    )
  } catch {
    return NextResponse.json({ displayTitle: videoId ? "YouTube" : getFallbackTitle(source) })
  }
}
