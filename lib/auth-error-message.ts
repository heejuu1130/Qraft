const authErrorMessages: Record<string, string> = {
  auth_failed: "로그인 시간이 만료되었습니다. 다시 시도해주세요.",
  bad_code_verifier: "로그인 시간이 만료되었습니다. 다시 시도해주세요.",
  missing_code: "로그인 정보를 확인하지 못했습니다. 다시 시도해주세요.",
  oauth_url_failed: "로그인 주소를 만들지 못했습니다. 다시 시도해주세요.",
  unsupported_provider: "지원하지 않는 로그인 방식입니다.",
}

const expiredLoginPatterns = [
  "bad_code_verifier",
  "code verifier",
  "code challenge",
  "pkce",
]

export function getAuthErrorMessage(error?: string | null, code?: string | null, message?: string | null) {
  const normalizedError = error?.trim().toLowerCase() ?? ""
  const normalizedCode = code?.trim().toLowerCase() ?? ""
  const normalizedMessage = message?.trim().toLowerCase() ?? ""
  const combined = `${normalizedError} ${normalizedCode} ${normalizedMessage}`

  if (expiredLoginPatterns.some((pattern) => combined.includes(pattern))) {
    return authErrorMessages.bad_code_verifier
  }

  return (
    authErrorMessages[normalizedCode] ??
    authErrorMessages[normalizedError] ??
    "로그인에 실패했습니다. 다시 시도해주세요."
  )
}
