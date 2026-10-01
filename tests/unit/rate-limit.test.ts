import { describe, expect, test } from "vitest"
import { conLimiteFallos, consultarFallos, resetearFallos } from "@/lib/rate-limit"

// Sin variables de Upstash: usa el contador en memoria, con la misma
// semántica que Redis (consulta sin incrementar, incrementa en el fallo,
// resetea en el éxito).
const opts = { key: "test-fallos", limit: 20, windowSec: 60 * 60 }
const ok = async () => ({ ok: true as const })
const malo = async () => ({ ok: false as const })
const intento = (cuenta: string, fn: () => Promise<{ ok: boolean }>) =>
  conLimiteFallos(opts, cuenta, fn, { fallo: (r) => !r.ok })

describe("conLimiteFallos", () => {
  test("25 intentos correctos seguidos no bloquean", async () => {
    for (let i = 0; i < 25; i++) {
      expect((await intento("a@x", ok)).bloqueado).toBe(false)
    }
    expect((await consultarFallos(opts, "a@x")).bloqueado).toBe(false)
  })

  test("20 fallos bloquean, también al intento correcto; otra cuenta no", async () => {
    for (let i = 0; i < 20; i++) {
      expect((await intento("B@x", malo)).bloqueado).toBe(false)
    }
    const bloqueado = await intento("b@x", ok)
    expect(bloqueado).toMatchObject({ bloqueado: true })
    expect(bloqueado.bloqueado && bloqueado.retryAfter).toBeGreaterThan(0)
    expect((await intento("c@x", ok)).bloqueado).toBe(false)
  })

  test("consultar no incrementa el contador", async () => {
    for (let i = 0; i < 50; i++) await consultarFallos(opts, "d@x")
    expect((await intento("d@x", ok)).bloqueado).toBe(false)
  })

  test("un intento correcto resetea el contador", async () => {
    for (let i = 0; i < 19; i++) await intento("e@x", malo)
    await intento("e@x", ok)
    for (let i = 0; i < 19; i++) await intento("e@x", malo)
    expect((await consultarFallos(opts, "e@x")).bloqueado).toBe(false)
    await intento("e@x", malo)
    expect((await consultarFallos(opts, "e@x")).bloqueado).toBe(true)
    await resetearFallos(opts, "e@x")
    expect((await consultarFallos(opts, "e@x")).bloqueado).toBe(false)
  })

  test("si el intento lanza, cuenta como fallo solo cuando falloError lo indica y relanza", async () => {
    const lanza = async (): Promise<{ ok: boolean }> => {
      throw new Error("contraseña actual incorrecta")
    }
    for (let i = 0; i < 20; i++) {
      await expect(conLimiteFallos(opts, "f@x", lanza, { falloError: () => true })).rejects.toThrow()
    }
    expect((await consultarFallos(opts, "f@x")).bloqueado).toBe(true)

    for (let i = 0; i < 25; i++) {
      await expect(conLimiteFallos(opts, "g@x", lanza)).rejects.toThrow()
    }
    expect((await consultarFallos(opts, "g@x")).bloqueado).toBe(false)
  })
})
