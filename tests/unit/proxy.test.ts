import { beforeAll, describe, expect, test, vi } from "vitest"
import { NextRequest } from "next/server"
import { generatePortalToken, generateToken } from "@/lib/jwt"
import { config, proxy } from "@/proxy"

beforeAll(() => {
  vi.stubEnv("JWT_SECRET", "secreto-de-test-con-longitud-suficiente")
})

const usuario = (rol: string) => ({ id: 1, email: "u@test.local", nombre: "U", rol, rol_id: 1 })

function req(path: string, token?: string) {
  const request = new NextRequest(`http://localhost${path}`)
  if (token) request.cookies.set("auth-token", token)
  return request
}

// Devuelve "next" o el destino de la redirección (ruta + query).
async function destino(path: string, token?: string) {
  const res = await proxy(req(path, token))
  const location = res.headers.get("location")
  if (!location) return "next"
  const url = new URL(location)
  return url.pathname + url.search
}

describe("proxy.ts", () => {
  test("sin sesión, /admin/* redirige al login con ?redirect=", async () => {
    expect(await destino("/admin/pedidos/12")).toBe("/login?redirect=%2Fadmin%2Fpedidos%2F12")
    expect(await destino("/admin/dashboard")).toBe("/login?redirect=%2Fadmin%2Fdashboard")
  })

  test("las rutas públicas pasan sin sesión", async () => {
    for (const path of ["/", "/catalogo", "/login", "/portal/login", "/portal/pedidos"]) {
      expect(await destino(path)).toBe("next")
    }
  })

  test("token inválido en /admin: al login y borra la cookie", async () => {
    const res = await proxy(req("/admin/dashboard", "no-es-un-jwt"))
    expect(new URL(res.headers.get("location")!).pathname).toBe("/login")
    expect(res.headers.get("set-cookie")).toMatch(/auth-token=;/)
  })

  test("un token del portal no sirve para el admin (audiencia)", async () => {
    const token = await generatePortalToken({ id: 1, email: "c@test.local", nombre: "C" }, 0)
    expect(await destino("/admin/dashboard", token)).toBe("/login")
  })

  test("redirecciones por rol según ROUTE_MODULES", async () => {
    const admin = await generateToken(usuario("administrador"), 0)
    const asistente = await generateToken(usuario("asistente"), 0)
    const soporte = await generateToken(usuario("soporte"), 0)

    expect(await destino("/admin/nomina", admin)).toBe("next")
    expect(await destino("/admin/pedidos/5", asistente)).toBe("next")
    expect(await destino("/admin/nomina", asistente)).toBe("/admin/dashboard")
    expect(await destino("/admin/soporte", asistente)).toBe("/admin/dashboard")
    expect(await destino("/admin/soporte", soporte)).toBe("next")
    expect(await destino("/admin/pedidos", soporte)).toBe("/admin/dashboard")
    expect(await destino("/admin/dashboard", soporte)).toBe("next")
  })

  test("rutas /admin desconocidas y roles desconocidos van al dashboard", async () => {
    const admin = await generateToken(usuario("administrador"), 0)
    const raro = await generateToken(usuario("invitado"), 0)
    expect(await destino("/admin/no-existe", admin)).toBe("/admin/dashboard")
    expect(await destino("/admin/pedidos", raro)).toBe("/admin/dashboard")
  })

  test("con sesión, /login redirige al dashboard", async () => {
    const admin = await generateToken(usuario("administrador"), 0)
    expect(await destino("/login", admin)).toBe("/admin/dashboard")
  })

  test("el matcher deja fuera /api y los estáticos", () => {
    const re = new RegExp(`^${config.matcher[0]}$`)
    expect(re.test("/admin/dashboard")).toBe(true)
    expect(re.test("/api/auth/login")).toBe(false)
    expect(re.test("/_next/static/chunk.js")).toBe(false)
    expect(re.test("/logo.png")).toBe(false)
  })
})
