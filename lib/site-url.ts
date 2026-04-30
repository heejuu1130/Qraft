const stripTrailingSlash = (value: string) => value.replace(/\/+$/, "")

const normalizeUrl = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return ""

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return stripTrailingSlash(withProtocol)
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

  const forwardedHost = request.headers.get("x-forwarded-host")
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https"
  const isLocalEnv = process.env.NODE_ENV === "development"

  if (isLocalEnv || !forwardedHost) {
    return stripTrailingSlash(fallbackOrigin)
  }

  return `${forwardedProto}://${forwardedHost}`
}
