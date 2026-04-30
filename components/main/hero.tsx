"use client"
import { useState } from "react"
import { MeshGradient, DotOrbit } from "@paper-design/shaders-react"

export default function Hero() {
  const [spreading] = useState(0.6)
  const [speed] = useState(0.15)
  const [activeEffect, setActiveEffect] = useState("structure")
  const [copied, setCopied] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText("pnpm i qraft.core")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  // 사막(Desert) 테마 팔레트
  const sandColors = ["#F9F8F6", "#EBE6DA", "#DFD6C8", "#D2C7B4"]
  const traceColor = "#8B7E6A"
  const orbitBg = "#EAE4D8"

  return (
    <div className="w-full h-screen bg-[#F9F8F6] relative overflow-hidden text-[#5C5446] selection:bg-[#D2C7B4] selection:text-white transition-colors duration-1000">

      {activeEffect === "void" && (
        <MeshGradient
          className="w-full h-full absolute inset-0 opacity-80"
          colors={sandColors}
          speed={speed}
        />
      )}

      {activeEffect === "trace" && (
        <div className="w-full h-full absolute inset-0 bg-[#F9F8F6]">
          <DotOrbit
            className="w-full h-full opacity-70"
            colors={[traceColor]}
            colorBack={orbitBg}
            speed={speed * 0.8}
            spreading={spreading}
          />
        </div>
      )}

      {activeEffect === "structure" && (
        <>
          <MeshGradient
            className="w-full h-full absolute inset-0 opacity-50"
            colors={sandColors}
            speed={speed * 0.5}
          />
          <div className="w-full h-full absolute inset-0 opacity-40">
            <DotOrbit
              className="w-full h-full"
              colors={[traceColor]}
              colorBack={orbitBg}
              speed={speed * 1.2}
              spreading={spreading * 0.5}
            />
          </div>
        </>
      )}

      <div className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-30">
        <div
          className="absolute top-1/4 left-1/3 w-64 h-64 bg-[#D2C7B4] rounded-full blur-[100px] animate-pulse"
          style={{ animationDuration: "12s" }}
        />
        <div
          className="absolute bottom-1/3 right-1/4 w-48 h-48 bg-[#EBE6DA] rounded-full blur-[80px] animate-pulse"
          style={{ animationDuration: "15s", animationDelay: "2s" }}
        />
      </div>

      <div className="absolute inset-0 flex flex-col pointer-events-none p-12">
        <div className="w-full flex justify-between items-start">
          <div className="font-serif text-sm tracking-[0.3em] uppercase opacity-60">
            Qraft
          </div>
          <div className="font-mono text-[10px] tracking-widest opacity-40">
            THE ARCHITECT OF SILENCE
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          <p className="font-serif text-lg tracking-widest opacity-70 text-center leading-loose">
            답이 아니라<br />질문이 사람을 깊게 만든다
          </p>

          <div className="font-mono text-xs opacity-50 tracking-[0.1em] mt-8 flex items-center gap-4 bg-white/30 px-6 py-3 rounded-none border border-[#EAE4D8] backdrop-blur-sm">
            <span>pnpm i qraft.core</span>
            <button
              onClick={copyToClipboard}
              className="pointer-events-auto hover:opacity-100 transition-opacity flex items-center justify-center"
              title="Copy to clipboard"
            >
              {copied ? (
                <span className="text-[10px] tracking-wider">COPIED</span>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="w-full flex justify-center gap-12 pointer-events-auto font-serif text-xs tracking-[0.2em] uppercase">
          {["void", "trace", "structure"].map((effect) => (
            <button
              key={effect}
              onClick={() => setActiveEffect(effect)}
              className={`transition-all duration-500 pb-1 border-b ${
                activeEffect === effect
                  ? "opacity-100 border-[#5C5446]"
                  : "opacity-30 border-transparent hover:opacity-60"
              }`}
            >
              {effect}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
