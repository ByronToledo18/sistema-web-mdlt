import { describe, expect, test } from "vitest"
import { DEFAULT_ADMIN_REDIRECT, sanitizeRedirect } from "@/lib/safe-redirect"

describe("sanitizeRedirect", () => {
  test("acepta rutas internas", () => {
    expect(sanitizeRedirect("/admin/pedidos")).toBe("/admin/pedidos")
    expect(sanitizeRedirect("/admin/pedidos/12?tab=pagos#items")).toBe("/admin/pedidos/12?tab=pagos#items")
    expect(sanitizeRedirect("/")).toBe("/")
  })

  test("sin valor usa el dashboard", () => {
    expect(sanitizeRedirect(null)).toBe(DEFAULT_ADMIN_REDIRECT)
    expect(sanitizeRedirect(undefined)).toBe(DEFAULT_ADMIN_REDIRECT)
    expect(sanitizeRedirect("")).toBe(DEFAULT_ADMIN_REDIRECT)
  })

  test.each([
    "https://evil.example",
    "http://evil.example/admin",
    "javascript:alert(1)",
    "evil.example",
    "//evil.example",
    "//evil.example/admin",
    "/\\evil.example",
    "/admin\\..\\evil",
    "/\t/evil.example",
    "/\n/evil.example",
    " /admin",
  ])("rechaza %j", (valor) => {
    expect(sanitizeRedirect(valor)).toBe(DEFAULT_ADMIN_REDIRECT)
  })

  test("respeta un fallback propio", () => {
    expect(sanitizeRedirect("//evil.example", "/catalogo")).toBe("/catalogo")
  })
})
