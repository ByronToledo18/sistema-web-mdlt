"use client"

import { useEffect } from "react"

export function ResizeObserverErrorSuppressor() {
  useEffect(() => {
    const errorHandler = (event: ErrorEvent) => {
      if (
        event.message?.includes("ResizeObserver loop") ||
        event.message?.includes("ResizeObserver loop completed with undelivered notifications")
      ) {
        event.stopImmediatePropagation()
        event.preventDefault()
        return true
      }
    }

    window.addEventListener("error", errorHandler)

    return () => {
      window.removeEventListener("error", errorHandler)
    }
  }, [])

  return null
}
