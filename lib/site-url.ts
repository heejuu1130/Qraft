const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "")

const normalizeUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ""

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return stripTrailingSlash(withProtocol)
}

const getHostname = (value: string) => {
  const normalizedUrl = normalizeUrl(value)
  if (!normalizedUrl) return ""

  try {
    return new URL(normalizedUrl).hostname.toLowerCase()
  } catch {
    return ""
  }
}

const normalizeForwardedHost = (value: string | null) => {
  const host = value?.split(",")[0]?.trim().toLowerCase() ?? ""

  if (!host || /[/?#\\]/.test(host)) return ""

  return host
}

const normalizeForwardedProto = (value: string | null) => {
  const proto = value?.split(",")[0]?.trim().toLowerCase()

  return proto === "http" || proto === "https" ? proto : "https"
}

const isTrustedForwardedHost = (forwardedHost: string, fallbackOrigin: string) => {
  const forwardedHostname = getHostname(forwardedHost)
  const fallbackHostname = getHostname(fallbackOrigin)

  if (!forwardedHostname) return false
  if (fallbackHostname && forwardedHostname === fallbackHostname) return true

  return forwardedHostname.endsWith(".vercel.app")
}

export function getSiteOrigin(request: Request, fallbackOrigin: string) {
  const configuredOrigin =
    normalizeUrl(process.env.NEXT_PUBLIC_SITE_URL ?? "") ||
    normalizeUrl(process.env.SITE_URL ?? "") ||
    normalizeUrl(process.env.NEXT_PUBLIC_VERCEL_URL ?? "") ||
    normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "") ||
    normalizeUrl(process.env.VERCEL_URL ?? "")

  if (configuredOrigin) {
    return configuredOrigin
  }

  const forwardedHost = normalizeForwardedHost(request.headers.get("x-forwarded-host"))
  const forwardedProto = normalizeForwardedProto(request.headers.get("x-forwarded-proto"))
  const isLocalEnv = process.env.NODE_ENV === "development"
  const normalizedFallbackOrigin = stripTrailingSlash(fallbackOrigin)

  if (isLocalEnv || !forwardedHost) {
    return normalizedFallbackOrigin
  }

  if (!isTrustedForwardedHost(forwardedHost, normalizedFallbackOrigin)) {
    return normalizedFallbackOrigin
  }

  return `${forwardedProto}://${forwardedHost}`
}
