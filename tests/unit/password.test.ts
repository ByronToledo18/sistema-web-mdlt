import { describe, expect, test } from "vitest"
import { hashPassword, needsRehash, PBKDF2_ITERATIONS, timingSafeEqualBytes, verifyPassword } from "@/lib/password"

// Hash en el formato anterior ("salt:hash", 100 000 iteraciones), generado
// con la versión previa de lib/password.ts.
async function hashAntiguo(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), { name: "PBKDF2" }, false, [
    "deriveBits",
  ])
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, key, 256)
  const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")
  return `${hex(salt)}:${hex(new Uint8Array(bits))}`
}

describe("lib/password", () => {
  test("el hash nuevo lleva versión e iteraciones y verifica", async () => {
    const hash = await hashPassword("secreta")
    const [prefijo, iteraciones, salt, derivado, ...resto] = hash.split("$")
    expect([prefijo, iteraciones, resto.length]).toEqual(["pbkdf2-sha256", String(PBKDF2_ITERATIONS), 0])
    expect(salt).toMatch(/^[0-9a-f]{32}$/)
    expect(derivado).toMatch(/^[0-9a-f]{64}$/)
    expect(PBKDF2_ITERATIONS).toBe(600_000)
    expect(await verifyPassword("secreta", hash)).toBe(true)
    expect(await verifyPassword("Secreta", hash)).toBe(false)
    expect(needsRehash(hash)).toBe(false)
  })

  test("los hashes antiguos siguen verificando y piden re-hash", async () => {
    const viejo = await hashAntiguo("secreta")
    expect(await verifyPassword("secreta", viejo)).toBe(true)
    expect(await verifyPassword("otra", viejo)).toBe(false)
    expect(needsRehash(viejo)).toBe(true)
  })

  test("un hash con menos iteraciones pide re-hash", async () => {
    const hash = (await hashPassword("x")).replace(`$${PBKDF2_ITERATIONS}$`, "$1000$")
    expect(needsRehash(hash)).toBe(true)
  })

  test("hashes vacíos o mal formados no verifican", async () => {
    const malos = [null, "", "abc", "$2b$10$bcrypt", "zz:yy", "pbkdf2-sha256$0$aa$bb", "pbkdf2-sha256$99999999$aa$bb"]
    for (const malo of malos) {
      expect(await verifyPassword("x", malo)).toBe(false)
    }
  })

  test("timingSafeEqualBytes", () => {
    expect(timingSafeEqualBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3]))).toBe(true)
    expect(timingSafeEqualBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4]))).toBe(false)
    expect(timingSafeEqualBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2]))).toBe(false)
  })
})
