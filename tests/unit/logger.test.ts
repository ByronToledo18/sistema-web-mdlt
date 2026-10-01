import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { logger, setLogSink } from "@/lib/logger"

describe("logger", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    vi.spyOn(console, "warn").mockImplementation(() => {})
    vi.spyOn(console, "info").mockImplementation(() => {})
  })

  afterEach(() => {
    setLogSink(null)
    vi.restoreAllMocks()
  })

  test("error escribe en consola con el contexto y el error", () => {
    const err = new Error("boom")
    logger.error("api/test POST", err, { pedidoId: 7 })
    expect(console.error).toHaveBeenCalledWith('[api/test POST] {"pedidoId":7}', err)
  })

  test("el sink recibe los mismos argumentos que el método", () => {
    const sink = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
    setLogSink(sink)
    const err = new Error("x")
    logger.error("ctx", err, { a: 1 })
    logger.warn("ctx", "cuidado", { b: 2 })
    logger.info("ctx", "hola")
    expect(sink.error).toHaveBeenCalledWith("ctx", err, { a: 1 })
    expect(sink.warn).toHaveBeenCalledWith("ctx", "cuidado", { b: 2 })
    expect(sink.info).toHaveBeenCalledWith("ctx", "hola", undefined)
  })

  test("una excepción dentro del sink no se propaga", () => {
    setLogSink({
      error: () => {
        throw new Error("sink caído")
      },
    })
    expect(() => logger.error("ctx", new Error("original"))).not.toThrow()
    expect(console.error).toHaveBeenCalled()
  })

  test("extra no serializable no rompe el log", () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(() => logger.warn("ctx", "msg", circular)).not.toThrow()
    expect(console.warn).toHaveBeenCalledWith("[ctx] msg [extra no serializable]")
  })

  test("sin sink registrado solo escribe en consola", () => {
    expect(() => logger.error("ctx")).not.toThrow()
    expect(console.error).toHaveBeenCalledWith("[ctx]", "")
  })
})
