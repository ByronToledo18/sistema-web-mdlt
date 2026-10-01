import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  captureRequestError: vi.fn(),
}))

import * as Sentry from "@sentry/nextjs"
import { logger, setLogSink } from "@/lib/logger"
import { sentryLogSink } from "@/lib/sentry-sink"

describe("sink de Sentry para el logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "info").mockImplementation(() => {})
  })

  afterEach(() => {
    setLogSink(null)
    vi.unstubAllEnvs()
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  test("error va a captureException con el contexto como tag", () => {
    setLogSink(sentryLogSink)
    const err = new Error("boom")
    logger.error("api/test POST", err, { pedidoId: 7 })
    expect(Sentry.captureException).toHaveBeenCalledWith(err, {
      tags: { context: "api/test POST" },
      extra: { pedidoId: 7 },
    })
  })

  test("warn va a captureMessage con nivel warning", () => {
    setLogSink(sentryLogSink)
    logger.warn("rate-limit", "sin Redis, uso memoria", { key: "login" })
    expect(Sentry.captureMessage).toHaveBeenCalledWith("[rate-limit] sin Redis, uso memoria", {
      level: "warning",
      extra: { key: "login" },
    })
  })

  test("info no llega a Sentry", () => {
    setLogSink(sentryLogSink)
    logger.info("ctx", "hola")
    expect(Sentry.captureException).not.toHaveBeenCalled()
    expect(Sentry.captureMessage).not.toHaveBeenCalled()
  })

  test("register() de instrumentation.ts registra el sink", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs")
    const { register } = await import("@/instrumentation")
    await register()
    logger.error("ctx", new Error("x"))
    expect(Sentry.init).toHaveBeenCalled()
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })

  // Next compila instrumentation.ts y las rutas en capas distintas, cada una
  // con su propia copia de lib/logger.ts: el sink tiene que verse desde todas.
  test("otra instancia del módulo logger ve el sink registrado", async () => {
    setLogSink(sentryLogSink)
    vi.resetModules()
    const otra = await import("@/lib/logger")
    expect(otra.logger).not.toBe(logger)
    otra.logger.error("ctx", new Error("x"))
    expect(Sentry.captureException).toHaveBeenCalledTimes(1)
  })
})
