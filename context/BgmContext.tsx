"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"

type BgmContextType = {
  bgmOn: boolean
  toggleBgm: () => void
}

const BgmContext = createContext<BgmContextType>({
  bgmOn: true,
  toggleBgm: () => {},
})

export function BgmProvider({ children }: { children: React.ReactNode }) {
  const [bgmOn, setBgmOn] = useState(true)
  const audioRef = useRef<HTMLAudioElement>(null)
  const bgmOnRef = useRef(true)

  const playAudio = useCallback(async (audio = audioRef.current) => {
    if (!audio || !bgmOnRef.current) return false

    audio.preload = "auto"
    audio.volume = 0.82
    audio.muted = false

    if (audio.readyState === 0) {
      audio.load()
    }

    try {
      await audio.play()
      return true
    } catch {
      return false
    }
  }, [])

  const setAudioElement = useCallback(
    (audio: HTMLAudioElement | null) => {
      audioRef.current = audio
      void playAudio(audio)
    },
    [playAudio]
  )

  useLayoutEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    void playAudio(audio)

    const playWhenReady = () => {
      void playAudio(audio)
    }
    const playDelays = [80, 240, 640, 1200]
    const playTimers = playDelays.map((delay) => window.setTimeout(playWhenReady, delay))

    audio.addEventListener("canplay", playWhenReady)
    audio.addEventListener("loadeddata", playWhenReady)
    audio.addEventListener("canplaythrough", playWhenReady)

    return () => {
      playTimers.forEach((timer) => window.clearTimeout(timer))
      audio.removeEventListener("canplay", playWhenReady)
      audio.removeEventListener("loadeddata", playWhenReady)
      audio.removeEventListener("canplaythrough", playWhenReady)
      audio.pause()
    }
  }, [playAudio])

  useEffect(() => {
    bgmOnRef.current = bgmOn

    const audio = audioRef.current
    if (!audio) return

    if (bgmOn) {
      void playAudio(audio)
    } else {
      audio.pause()
    }
  }, [bgmOn, playAudio])

  useEffect(() => {
    if (!bgmOn) return

    const removeInteractionListeners = () => {
      window.removeEventListener("click", playOnInteraction)
      window.removeEventListener("pointerdown", playOnInteraction)
      window.removeEventListener("mousedown", playOnInteraction)
      window.removeEventListener("touchstart", playOnInteraction)
      window.removeEventListener("wheel", playOnInteraction)
      window.removeEventListener("keydown", playOnInteraction)
    }

    const playOnInteraction = () => {
      void playAudio().then((played) => {
        if (played) {
          removeInteractionListeners()
        }
      })
    }

    window.addEventListener("click", playOnInteraction)
    window.addEventListener("pointerdown", playOnInteraction)
    window.addEventListener("mousedown", playOnInteraction)
    window.addEventListener("touchstart", playOnInteraction, { passive: true })
    window.addEventListener("wheel", playOnInteraction, { passive: true })
    window.addEventListener("keydown", playOnInteraction)

    return () => {
      removeInteractionListeners()
    }
  }, [bgmOn, playAudio])

  return (
    <BgmContext.Provider value={{ bgmOn, toggleBgm: () => setBgmOn((value) => !value) }}>
      <audio ref={setAudioElement} src="/bgm-start.mp3" loop autoPlay preload="auto" playsInline />
      {children}
    </BgmContext.Provider>
  )
}

export const useBgm = () => useContext(BgmContext)
