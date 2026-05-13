"use client"

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"

const BGM_SRC = "/bgm.mp3"
const BGM_VOLUME = 0.82
const BGM_ON_STORAGE_KEY = "qraft:bgm-on"
const BGM_TIME_STORAGE_KEY = "qraft:bgm-current-time"
const BGM_TIME_SYNC_MS = 1000

type BgmContextType = {
  bgmOn: boolean
  toggleBgm: () => void
}

type ClientStorageName = "localStorage" | "sessionStorage"

declare global {
  interface Window {
    __qraftBgmAudio?: HTMLAudioElement | null
  }
}

const BgmContext = createContext<BgmContextType>({
  bgmOn: true,
  toggleBgm: () => {},
})

const warnStorageSkipped = (label: string, error: unknown) => {
  if (process.env.NODE_ENV !== "production") {
    console.warn(label, error)
  }
}

const readStorageItem = (storageName: ClientStorageName, key: string) => {
  try {
    return window[storageName].getItem(key)
  } catch (error) {
    warnStorageSkipped(`${storageName} read skipped`, error)
    return null
  }
}

const writeStorageItem = (storageName: ClientStorageName, key: string, value: string) => {
  try {
    window[storageName].setItem(key, value)
  } catch (error) {
    warnStorageSkipped(`${storageName} write skipped`, error)
  }
}

const readStoredBgmOn = () => {
  if (typeof window === "undefined") return true

  return readStorageItem("localStorage", BGM_ON_STORAGE_KEY) !== "false"
}

const readStoredBgmTime = () => {
  if (typeof window === "undefined") return 0

  const storedTime = Number(readStorageItem("sessionStorage", BGM_TIME_STORAGE_KEY))

  return Number.isFinite(storedTime) && storedTime > 0 ? storedTime : 0
}

const writeStoredBgmTime = (time: number) => {
  if (typeof window === "undefined" || !Number.isFinite(time)) return

  writeStorageItem("sessionStorage", BGM_TIME_STORAGE_KEY, String(time))
}

export function BgmProvider({ children }: { children: React.ReactNode }) {
  const [bgmOn, setBgmOn] = useState(true)
  const [bgmPreferenceReady, setBgmPreferenceReady] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const bgmOnRef = useRef(true)
  const bgmPreferenceReadyRef = useRef(false)

  const toggleBgm = useCallback(() => setBgmOn((v) => !v), [])

  const playAudio = useCallback(async () => {
    const audio = audioRef.current
    if (!audio || !bgmPreferenceReadyRef.current || !bgmOnRef.current) return false

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

        const storedTime = readStoredBgmTime()
        if (storedTime > 0) {
          try {
            audio.currentTime = storedTime
          } catch {}
        }

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
      writeStoredBgmTime(audio.currentTime)
      audio.pause()

      if (window.__qraftBgmAudio === audio) {
        window.__qraftBgmAudio = null
      }
    }
  }, [playAudio])

  useEffect(() => {
    const preferenceTimer = window.setTimeout(() => {
      const storedBgmOn = readStoredBgmOn()

      bgmOnRef.current = storedBgmOn
      bgmPreferenceReadyRef.current = true
      setBgmOn(storedBgmOn)
      setBgmPreferenceReady(true)
    }, 0)

    return () => window.clearTimeout(preferenceTimer)
  }, [])

  useEffect(() => {
    if (!bgmPreferenceReady) return

    bgmOnRef.current = bgmOn
    writeStorageItem("localStorage", BGM_ON_STORAGE_KEY, String(bgmOn))

    const audio = audioRef.current
    if (!audio) return

    if (bgmOn) {
      void playAudio()
    } else {
      audio.pause()
    }
  }, [bgmOn, bgmPreferenceReady, playAudio])

  useEffect(() => {
    const syncBgmTime = () => {
      const audio = audioRef.current
      if (!audio) return

      writeStoredBgmTime(audio.currentTime)
    }

    const syncTimer = window.setInterval(syncBgmTime, BGM_TIME_SYNC_MS)

    window.addEventListener("pagehide", syncBgmTime)
    document.addEventListener("visibilitychange", syncBgmTime)

    return () => {
      window.clearInterval(syncTimer)
      window.removeEventListener("pagehide", syncBgmTime)
      document.removeEventListener("visibilitychange", syncBgmTime)
      syncBgmTime()
    }
  }, [])

  useEffect(() => {
    if (!bgmPreferenceReady || !bgmOn) return

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
  }, [bgmOn, bgmPreferenceReady, playAudio])

  return (
    <BgmContext.Provider value={{ bgmOn, toggleBgm }}>
      <audio ref={setAudioElement} src={BGM_SRC} loop preload="auto" playsInline />
      {children}
    </BgmContext.Provider>
  )
}

export const useBgm = () => useContext(BgmContext)
