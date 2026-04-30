"use client"

import { createContext, useContext, useEffect, useRef, useState } from "react"

type BgmContextType = {
  bgmOn: boolean
  toggleBgm: () => void
}

const BgmContext = createContext<BgmContextType>({
  bgmOn: false,
  toggleBgm: () => {},
})

export function BgmProvider({ children }: { children: React.ReactNode }) {
  const [bgmOn, setBgmOn] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    return () => { audio.pause() }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    if (bgmOn) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [bgmOn])

  return (
    <BgmContext.Provider value={{ bgmOn, toggleBgm: () => setBgmOn((value) => !value) }}>
      <audio ref={audioRef} src="/bgm.mp3" loop />
      {children}
    </BgmContext.Provider>
  )
}

export const useBgm = () => useContext(BgmContext)
