"use client"

import { useEffect, useMemo, useState } from "react"

type NavigatorPerformanceSignals = Navigator & {
  connection?: {
    effectiveType?: string
    saveData?: boolean
  }
  deviceMemory?: number
}

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

export function usePerformanceMode() {
  const [pageVisible, setPageVisible] = useState(() =>
    typeof document === "undefined" ? true : document.visibilityState === "visible"
  )
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
  const [constrainedDevice] = useState(isConstrainedDevice)

  useEffect(() => {
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    const updateVisibility = () => {
      setPageVisible(document.visibilityState === "visible")
    }
    const updateMotion = () => {
      setPrefersReducedMotion(motionQuery.matches)
    }

    document.addEventListener("visibilitychange", updateVisibility)
    motionQuery.addEventListener("change", updateMotion)

    return () => {
      document.removeEventListener("visibilitychange", updateVisibility)
      motionQuery.removeEventListener("change", updateMotion)
    }
  }, [])

  return useMemo(
    () => ({
      constrainedDevice,
      pageVisible,
      pauseCssMotion: !pageVisible || prefersReducedMotion,
      prefersReducedMotion,
      reduceShaderLoad: constrainedDevice || prefersReducedMotion,
      renderShader: pageVisible && !prefersReducedMotion,
    }),
    [constrainedDevice, pageVisible, prefersReducedMotion]
  )
}
