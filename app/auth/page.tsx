"use client"

import { MeshGradient } from "@paper-design/shaders-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { gtag } from "@/lib/gtag"

const desert = {
    background: "#120b07",
    ember: "#8d4f31",
    sand: "#efd3a2",
}

export default function AuthPage() {
    const [hasError, setHasError] = useState(false)
    const [errorCode, setErrorCode] = useState("")
    const [errorMessage, setErrorMessage] = useState("")

    useEffect(() => {
        const timer = window.setTimeout(() => {
            const params = new URLSearchParams(window.location.search)
            setHasError(params.has("error"))
            setErrorCode(params.get("code") ?? params.get("error") ?? "")
            setErrorMessage(params.get("message") ?? "")
        }, 0)

        return () => window.clearTimeout(timer)
    }, [])

    return (
        <div className="relative h-screen w-full overflow-hidden bg-[#120b07]">
            <div className="absolute inset-0">
                <MeshGradient
                    className="absolute inset-0 h-full w-full"
                    colors={[desert.background, "#2a170e", desert.ember, desert.sand]}
                    speed={0.5}
                />
                <div className="pointer-events-none absolute inset-0 bg-[#120b07]/35" />
            </div>

            <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
                <div
                    className="w-full max-w-xs border border-[#d9ad73]/25 bg-[#120b07]/90 p-8 shadow-[0_24px_80px_rgba(13,8,5,0.72)] backdrop-blur-xl"
                    style={{ animation: "qraft-reveal 300ms ease-out forwards" }}
                >
                    <p className="font-mono text-[10px] font-medium uppercase leading-none tracking-[0.18em] text-[#d2ad7c]/55">
                        Sign in
                    </p>
                    <p
                        className="mt-3 text-sm font-medium leading-[1.6] text-[#f5dfbd]/60"
                        style={{ fontFamily: '"DM Sans", "Helvetica Neue", Helvetica, Arial, sans-serif' }}
                    >
                        질문 히스토리를 저장하시려면 로그인하세요
                    </p>
                    {hasError && (
                        <div className="mt-3 space-y-1">
                            <p className="text-xs font-medium text-red-400/80">
                                {errorMessage || "로그인에 실패했습니다. 다시 시도해주세요."}
                            </p>
                            {errorCode && (
                                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-red-300/45">
                                    {errorCode}
                                </p>
                            )}
                        </div>
                    )}

                    <div className="mt-6 flex flex-col gap-3">
                        <Link
                            href="/auth/sign-in?provider=google&next=/"
                            onClick={() => gtag.login("google")}
                            className="flex h-11 w-full items-center justify-center gap-3 border border-[#d9ad73]/30 bg-[#f5dfbd]/10 px-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#f5dfbd]/80 transition-colors duration-300 hover:border-[#d9ad73]/60 hover:bg-[#f5dfbd]/15 focus:outline-none"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            Continue with Google
                        </Link>

                        <Link
                            href="/auth/sign-in?provider=kakao&next=/"
                            onClick={() => gtag.login("kakao")}
                            className="flex h-11 w-full items-center justify-center gap-3 border border-[#d9ad73]/30 bg-[#FEE500]/10 px-4 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-[#FEE500]/80 transition-colors duration-300 hover:border-[#FEE500]/40 hover:bg-[#FEE500]/15 focus:outline-none"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="#FEE500" aria-hidden="true">
                                <path d="M12 3C7.03 3 3 6.36 3 10.5c0 2.62 1.7 4.93 4.27 6.28L6.2 20.1a.5.5 0 0 0 .72.55l4.08-2.7c.33.03.67.05 1 .05 4.97 0 9-3.36 9-7.5S16.97 3 12 3z" />
                            </svg>
                            Continue with Kakao
                        </Link>
                    </div>

                    <Link
                        href="/"
                        className="mt-6 block w-full text-center font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#f5dfbd]/30 transition-colors duration-300 hover:text-[#f5dfbd]/55"
                    >
                        돌아가기
                    </Link>
                </div>
            </div>
        </div>
    )
}
