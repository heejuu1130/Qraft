import { NextResponse } from "next/server"
import { createRouteClient } from "@/lib/supabase/route"

type FeedbackRequestBody = {
  message?: unknown
  rating?: unknown
  pagePath?: unknown
}

type SupabaseInsertError = {
  code?: string
  message?: string
  details?: string
}

const getFeedbackError = (error: SupabaseInsertError) => {
  const code = error.code ?? ""
  const message = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase()

  if (code === "42501" || message.includes("permission") || message.includes("row-level security")) {
    return {
      status: 403,
      code: "feedback_permission_denied",
      message: "코멘트 저장 권한 설정을 확인해야 합니다. 잠시 후 다시 남겨주세요.",
    }
  }

  if (code === "42703" || code === "PGRST204" || message.includes("column") || message.includes("not-null")) {
    return {
      status: 503,
      code: "feedback_schema_outdated",
      message: "별점 저장을 위해 Supabase SQL을 먼저 적용해야 합니다.",
    }
  }

  if (
    code === "42P01" ||
    code === "PGRST205" ||
    message.includes("could not find") ||
    message.includes("schema cache")
  ) {
    return {
      status: 503,
      code: "feedback_table_missing",
      message: "코멘트 저장 테이블이 아직 준비되지 않았습니다. Supabase SQL을 적용한 뒤 다시 남겨주세요.",
    }
  }

  return {
    status: 500,
    code: "feedback_insert_failed",
    message: "지금은 기록하지 못했습니다. 잠시 후 다시 남겨주세요.",
  }
}

export async function POST(request: Request) {
  let body: FeedbackRequestBody

  try {
    body = (await request.json()) as FeedbackRequestBody
  } catch {
    return NextResponse.json(
      { message: "코멘트 내용을 다시 확인해 주세요.", code: "invalid_feedback_payload" },
      { status: 400 }
    )
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  const hasRatingValue = body.rating !== undefined && body.rating !== null
  const rating =
    typeof body.rating === "number" && Number.isInteger(body.rating) && body.rating >= 1 && body.rating <= 5
      ? body.rating
      : null

  if (hasRatingValue && rating === null) {
    return NextResponse.json(
      { message: "별점은 1점부터 5점까지 선택해 주세요.", code: "invalid_feedback_rating" },
      { status: 400 }
    )
  }

  if (!message && rating === null) {
    return NextResponse.json(
      { message: "별점 또는 코멘트를 남겨주세요.", code: "empty_feedback" },
      { status: 400 }
    )
  }

  if (message.length > 0 && (message.length < 2 || message.length > 1200)) {
    return NextResponse.json(
      { message: "코멘트는 2자 이상 1200자 이하로 남겨주세요.", code: "invalid_feedback_message" },
      { status: 400 }
    )
  }

  const pagePath = typeof body.pagePath === "string" ? body.pagePath.slice(0, 500) : null
  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null
  const { supabase, applyCookies } = await createRouteClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from("user_feedback").insert({
    user_id: user?.id ?? null,
    message: message || null,
    rating,
    page_path: pagePath,
    user_agent: userAgent,
  })

  if (error) {
    console.error(error)
    const feedbackError = getFeedbackError(error)

    return applyCookies(
      NextResponse.json(
        { message: feedbackError.message, code: feedbackError.code },
        { status: feedbackError.status }
      )
    )
  }

  return applyCookies(NextResponse.json({ ok: true }))
}
