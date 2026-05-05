"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"

const BGM_SRC = "/bgm.mp3"
const BGM_VOLUME = 0.82

type BgmContextType = {
  bgmOn: boolean
  toggleBgm: () => void
}

declare global {
  interface Window {
    __qraftBgmAudio?: HTMLAudioElement | null
  }
}

const BgmContext = createContext<BgmContextType>({
  bgmOn: true,
  toggleBgm: () => {},
})

export function BgmProvider({ children }: { children: React.ReactNode }) {
  const [bgmOn, setBgmOn] = useState(true)
  const audioRef = useRef<HTMLAudioElement>(null)
  const bgmOnRef = useRef(true)

  const toggleBgm = useCallback(() => setBgmOn((v) => !v), [])

  const playAudio = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !bgmOnRef.current) return false

    if (window.__qraftBgmAudio && window.__qraftBgmAudio !== audio) {
      window.__qraftBgmAudio.pause()
    }

    window.__qraftBgmAudio = audio
    audio.loop = true
    audio.muted = false
    audio.preload = "auto"
    audio.volume = BGM_VOLUME

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
      const previousAudio = audioRef.current
      if (previousAudio && previousAudio !== audio) {
        previousAudio.pause()
        previousAudio.currentTime = 0

        if (window.__qraftBgmAudio === previousAudio) {
          window.__qraftBgmAudio = null
        }
      }

      audioRef.current = audio

      if (audio) {
        audio.loop = true
        audio.preload = "auto"
        audio.volume = BGM_VOLUME
        void playAudio()
      }
    },
    [playAudio]
  )

  useLayoutEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const playWhenReady = () => {
      void playAudio()
    }

    const retryDelays = [60, 180, 420, 900, 1800, 3200]
    const retryTimers = retryDelays.map((delay) => window.setTimeout(playWhenReady, delay))

    playWhenReady()

    audio.addEventListener("canplay", playWhenReady)
    audio.addEventListener("loadeddata", playWhenReady)
    audio.addEventListener("canplaythrough", playWhenReady)

    return () => {
      retryTimers.forEach((timer) => window.clearTimeout(timer))
      audio.removeEventListener("canplay", playWhenReady)
      audio.removeEventListener("loadeddata", playWhenReady)
      audio.removeEventListener("canplaythrough", playWhenReady)
      audio.pause()

      if (window.__qraftBgmAudio === audio) {
        window.__qraftBgmAudio = null
      }
    }
  }, [playAudio])

  useEffect(() => {
    bgmOnRef.current = bgmOn

    const audio = audioRef.current
    if (!audio) return

    if (bgmOn) {
      void playAudio()
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
      window.removeEventListener("focus", playOnInteraction)
      document.removeEventListener("visibilitychange", playOnVisibility)
    }

    const playOnInteraction = () => {
      void playAudio().then((played) => {
        if (played) {
          removeInteractionListeners()
        }
      })
    }

    const playOnVisibility = () => {
      if (document.visibilityState === "visible") {
        playOnInteraction()
      }
    }

    window.addEventListener("click", playOnInteraction)
    window.addEventListener("pointerdown", playOnInteraction)
    window.addEventListener("mousedown", playOnInteraction)
    window.addEventListener("touchstart", playOnInteraction, { passive: true })
    window.addEventListener("wheel", playOnInteraction, { passive: true })
    window.addEventListener("keydown", playOnInteraction)
    window.addEventListener("focus", playOnInteraction)
    document.addEventListener("visibilitychange", playOnVisibility)

    return () => {
      removeInteractionListeners()
    }
  }, [bgmOn, playAudio])

  return (
    <BgmContext.Provider value={{ bgmOn, toggleBgm }}>
      <audio ref={setAudioElement} src={BGM_SRC} loop preload="auto" playsInline />
      {children}
    </BgmContext.Provider>
  )
}

export const useBgm = () => useContext(BgmContext)
