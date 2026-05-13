"use client"

import { useEffect, useMemo, useState } from "react"

type BackgroundMotionMode = "frozen" | "reduced" | "warming" | "enhancing" | "full"

type NavigatorPerformanceSignals = Navigator & {
  connection?: {
    effectiveType?: string
    saveData?: boolean
  }
  deviceMemory?: number
  userAgentData?: {
    brands?: Array<{ brand: string; version: string }>
  }
}

const SHADER_MODE_SESSION_KEY = "qraft_shader_mode_v5"
const SHADER_MODE_OVERRIDE_PARAM = "qraft_bg"
const FPS_SAMPLE_DURATION_MS = 900
const CHROMIUM_FPS_SAMPLE_DURATION_MS = 1400
const FULL_MODE_WARMUP_DELAY_MS = 180
const FULL_MODE_ENHANCE_DURATION_MS = 3200
const FPS_FULL_THRESHOLD = 55
const CHROMIUM_FPS_FULL_THRESHOLD = 58
const FPS_FROZEN_THRESHOLD = 40

function isConstrainedDevice() {
  if (typeof navigator === "undefined") return false

  const performanceNavigator = navigator as NavigatorPerformanceSignals
  const hardwareConcurrency = performanceNavigator.hardwareConcurrency ?? 8
  const deviceMemory = performanceNavigator.deviceMemory ?? 8
  const connection = performanceNavigator.connection

  return (
    hardwareConcurrency <= 4 ||
    deviceMemory <= 4 ||
    connection?.saveData === true ||
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g" ||
    connection?.effectiveType === "3g"
  )
}

function isCompactTouchViewport() {
  if (typeof window === "undefined") return false

  return window.matchMedia("(max-width: 767px), (hover: none) and (pointer: coarse)").matches
}

function isChromiumBrowser() {
  if (typeof navigator === "undefined") return false

  const performanceNavigator = navigator as NavigatorPerformanceSignals
  const brands = performanceNavigator.userAgentData?.brands ?? []

  if (brands.length > 0) {
    return brands.some(({ brand }) => /Chromium|Google Chrome/i.test(brand))
  }

  return /Chrome|Chromium|CriOS/i.test(navigator.userAgent)
}

function isBackgroundMotionMode(value: string | null): value is BackgroundMotionMode {
  return value === "frozen" || value === "reduced" || value === "warming" || value === "enhancing" || value === "full"
}

function readShaderModeCache(): BackgroundMotionMode | null {
  try {
    const value = window.sessionStorage.getItem(SHADER_MODE_SESSION_KEY)
    if (isBackgroundMotionMode(value)) return value
  } catch {}

  return null
}

function readShaderModeOverride(): BackgroundMotionMode | null {
  if (typeof window === "undefined") return null

  try {
    const value = new URLSearchParams(window.location.search).get(SHADER_MODE_OVERRIDE_PARAM)
    if (isBackgroundMotionMode(value)) return value
  } catch {}

  return null
}

function writeShaderModeCache(mode: BackgroundMotionMode) {
  try {
    window.sessionStorage.setItem(SHADER_MODE_SESSION_KEY, mode)
  } catch {}
}

function getFpsConfig() {
  const chromium = isChromiumBrowser()

  return {
    fullThreshold: chromium ? CHROMIUM_FPS_FULL_THRESHOLD : FPS_FULL_THRESHOLD,
    sampleDurationMs: chromium ? CHROMIUM_FPS_SAMPLE_DURATION_MS : FPS_SAMPLE_DURATION_MS,
  }
}

function getModeFromFps(fps: number, fullThreshold: number): BackgroundMotionMode {
  if (fps >= fullThreshold) return "full"
  if (fps < FPS_FROZEN_THRESHOLD) return "frozen"
  return "reduced"
}

export function usePerformanceMode() {
  const [pageVisible, setPageVisible] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const [compactTouchViewport, setCompactTouchViewport] = useState(false)
  const [constrainedDevice, setConstrainedDevice] = useState(false)
  const [measuredMotionMode, setMeasuredMotionMode] = useState<BackgroundMotionMode>("frozen")

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 767px), (hover: none) and (pointer: coarse)")
    let frameId: number | undefined

    const syncSignals = () => {
      frameId = undefined
      const nextPageVisible = document.visibilityState === "visible"
      const nextPrefersReducedMotion = motionQuery.matches
      const nextCompactTouchViewport = isCompactTouchViewport()
      const nextConstrainedDevice = isConstrainedDevice()
      const overrideMode = readShaderModeOverride()
      const cachedMode = readShaderModeCache()

      setPageVisible(nextPageVisible)
      setPrefersReducedMotion(nextPrefersReducedMotion)
      setCompactTouchViewport(nextCompactTouchViewport)
      setConstrainedDevice(nextConstrainedDevice)
      setMeasuredMotionMode((currentMode) => {
        if (nextPrefersReducedMotion || nextConstrainedDevice) return "frozen"
        if (overrideMode) return overrideMode
        if (cachedMode === "full") {
          return currentMode === "warming" || currentMode === "enhancing" || currentMode === "full"
            ? currentMode
            : "warming"
        }
        return cachedMode ?? currentMode
      })
    }
    const queueSignalSync = () => {
      if (frameId !== undefined) return
      frameId = window.requestAnimationFrame(syncSignals)
    }

    const updateVisibility = () => {
      setPageVisible(document.visibilityState === "visible")
      queueSignalSync()
    }
    const updateMotion = queueSignalSync
    const updateCompactViewport = queueSignalSync

    queueSignalSync()

    document.addEventListener("visibilitychange", updateVisibility)
    motionQuery.addEventListener("change", updateMotion)
    compactViewportQuery.addEventListener("change", updateCompactViewport)

    return () => {
      document.removeEventListener("visibilitychange", updateVisibility)
      motionQuery.removeEventListener("change", updateMotion)
      compactViewportQuery.removeEventListener("change", updateCompactViewport)
      if (frameId !== undefined) window.cancelAnimationFrame(frameId)
    }
  }, [])

  // Runtime FPS measurement starts from a still background, then enables motion
  // only when the browser proves it has enough headroom.
  useEffect(() => {
    if (!pageVisible || prefersReducedMotion || constrainedDevice) return
    if (measuredMotionMode !== "frozen" && measuredMotionMode !== "reduced") return
    if (readShaderModeOverride() !== null) return
    if (readShaderModeCache() !== null) return

    let rafId: number
    let startTs: number | null = null
    let frames = 0
    const fpsConfig = getFpsConfig()

    const measure = (ts: number) => {
      if (startTs === null) {
        startTs = ts
        rafId = window.requestAnimationFrame(measure)
        return
      }

      frames += 1
      const elapsed = ts - startTs

      if (elapsed < fpsConfig.sampleDurationMs) {
        rafId = window.requestAnimationFrame(measure)
        return
      }

      const fps = (frames * 1000) / elapsed
      const nextMode = getModeFromFps(fps, fpsConfig.fullThreshold)
      writeShaderModeCache(nextMode)

      if (nextMode === "full") {
        setMeasuredMotionMode("warming")
        return
      }

      setMeasuredMotionMode(nextMode)
    }

    rafId = window.requestAnimationFrame(measure)
    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [constrainedDevice, measuredMotionMode, pageVisible, prefersReducedMotion])

  useEffect(() => {
    if (!pageVisible || prefersReducedMotion || constrainedDevice) return
    if (measuredMotionMode !== "warming") return

    const enhanceTimeoutId = window.setTimeout(() => setMeasuredMotionMode("enhancing"), FULL_MODE_WARMUP_DELAY_MS)
    const fullTimeoutId = window.setTimeout(
      () => setMeasuredMotionMode("full"),
      FULL_MODE_WARMUP_DELAY_MS + FULL_MODE_ENHANCE_DURATION_MS
    )

    return () => {
      window.clearTimeout(enhanceTimeoutId)
      window.clearTimeout(fullTimeoutId)
    }
  }, [constrainedDevice, measuredMotionMode, pageVisible, prefersReducedMotion])

  const overrideMotionMode = readShaderModeOverride()
  const backgroundMotionMode: BackgroundMotionMode =
    overrideMotionMode ??
    (!pageVisible || prefersReducedMotion || constrainedDevice
      ? "frozen"
      : compactTouchViewport && measuredMotionMode === "full"
        ? "reduced"
        : measuredMotionMode)

  return useMemo(
    () => ({
      backgroundMotionMode,
      compactTouchViewport,
      constrainedDevice,
      pageVisible,
      pauseCssMotion: !pageVisible || prefersReducedMotion,
      prefersReducedMotion,
      reduceShaderLoad: backgroundMotionMode !== "full",
      renderShader: pageVisible && backgroundMotionMode !== "frozen",
    }),
    [backgroundMotionMode, compactTouchViewport, constrainedDevice, pageVisible, prefersReducedMotion]
  )
}
