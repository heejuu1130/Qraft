import { NextResponse } from "next/server"
import { getSiteOrigin } from "@/lib/site-url"
import { createRouteClient } from "@/lib/supabase/route"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const siteOrigin = getSiteOrigin(request, origin)
  const code = searchParams.get("code")
  const providerError = searchParams.get("error")
  const providerErrorCode = searchParams.get("error_code")
  const providerErrorDescription = searchParams.get("error_description")
  let next = searchParams.get("next") ?? "/"

  if (!next.startsWith("/")) {
    next = "/"
  }

  const { supabase, applyCookies } = await createRouteClient()

  const redirectTo = (path: string) => applyCookies(NextResponse.redirect(`${siteOrigin}${path}`))

  if (providerError) {
    console.error(
      "Auth provider error:",
      providerError,
      providerErrorCode ?? "",
      providerErrorDescription ?? ""
    )
    const params = new URLSearchParams({
      error: providerError,
    })

    if (providerErrorCode) {
      params.set("code", providerErrorCode)
    }

    if (providerErrorDescription) {
      params.set("message", providerErrorDescription)
    }

    return redirectTo(`/auth?${params.toString()}`)
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error("Auth callback error:", error.message)
      const params = new URLSearchParams({
        error: "auth_failed",
        message: error.message,
      })

      if ("code" in error && typeof error.code === "string") {
        params.set("code", error.code)
      }

      return redirectTo(`/auth?${params.toString()}`)
    }

    return redirectTo(next)
  }

  return redirectTo("/auth?error=missing_code")
}
