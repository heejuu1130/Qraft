import type { Provider } from "@supabase/supabase-js"
import { NextResponse } from "next/server"
import { getSiteOrigin } from "@/lib/site-url"
import { createRouteClient } from "@/lib/supabase/route"

const supportedProviders = new Set(["google", "kakao"])

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const origin = getSiteOrigin(request, requestUrl.origin)
  const provider = requestUrl.searchParams.get("provider") ?? ""
  let next = requestUrl.searchParams.get("next") ?? "/"

  if (!supportedProviders.has(provider)) {
    return NextResponse.redirect(`${origin}/auth?error=unsupported_provider`)
  }

  if (!next.startsWith("/")) {
    next = "/"
  }

  const callbackUrl = new URL("/auth/callback", origin)
  callbackUrl.searchParams.set("next", next)

  const { supabase, applyCookies } = await createRouteClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as Provider,
    options: {
      redirectTo: callbackUrl.toString(),
      ...(provider === "kakao" ? { scopes: "profile_nickname" } : {}),
    },
  })

  if (error || !data.url) {
    const params = new URLSearchParams({
      error: error?.code ?? "oauth_url_failed",
      message: error?.message ?? "로그인 주소를 만들지 못했습니다.",
    })

    return applyCookies(NextResponse.redirect(`${origin}/auth?${params.toString()}`))
  }

  return applyCookies(NextResponse.redirect(data.url))
}
