import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const providerError = searchParams.get("error")
  const providerErrorDescription = searchParams.get("error_description")
  let next = searchParams.get("next") ?? "/"

  if (!next.startsWith("/")) {
    next = "/"
  }

  const redirectTo = (path: string) => {
    const forwardedHost = request.headers.get("x-forwarded-host")
    const isLocalEnv = process.env.NODE_ENV === "development"

    if (isLocalEnv || !forwardedHost) {
      return NextResponse.redirect(`${origin}${path}`)
    }

    return NextResponse.redirect(`https://${forwardedHost}${path}`)
  }

  if (providerError) {
    console.error("Auth provider error:", providerError, providerErrorDescription ?? "")
    const params = new URLSearchParams({
      error: providerError,
    })

    if (providerErrorDescription) {
      params.set("message", providerErrorDescription)
    }

    return redirectTo(`/auth?${params.toString()}`)
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("Auth callback error:", error.message)
      return redirectTo(`/auth?error=auth_failed&message=${encodeURIComponent(error.message)}`)
    }

    return redirectTo(next)
  }

  return redirectTo("/auth?error=missing_code")
}
