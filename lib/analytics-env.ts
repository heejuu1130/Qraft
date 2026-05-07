const analyticsDisabledFlag = process.env.NEXT_PUBLIC_DISABLE_ANALYTICS === "true"

const localAnalyticsHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"])

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map((part) => Number(part))

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false
  }

  const [first, second] = parts

  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168)
}

export function shouldDisableClientAnalytics() {
  if (analyticsDisabledFlag) return true
  if (process.env.NODE_ENV !== "production") return true
  if (typeof window === "undefined") return false

  const hostname = window.location.hostname

  return localAnalyticsHostnames.has(hostname) || hostname.endsWith(".local") || isPrivateIpv4(hostname)
}
