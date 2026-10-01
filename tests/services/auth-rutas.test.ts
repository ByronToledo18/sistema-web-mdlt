import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest"
import { NextRequest } from "next/server"
import { POST as loginAdmin } from "@/app/api/auth/login/route"
import { POST as logoutAdmin } from "@/app/api/auth/logout/route"
import { POST as loginPortal } from "@/app/api/portal/login/route"
import { POST as logoutPortal } from "@/app/api/portal/logout/route"
import { POST as registroPortal } from "@/app/api/portal/registro/route"
import { POST as crearTicketPublico } from "@/app/api/soporte/tickets/route"
import { getClienteFromToken, getCurrentUser } from "@/lib/auth"
import { hashPassword } from "@/lib/password"
import { db } from "@/server/db/client"
import { roles, tickets, usuarios } from "@/server/db/schema"
import { resetDb } from "../support/db-client"
import { crearCliente } from "../support/fixtures"

// Las rutas leen y escriben cookies con next/headers; aquí es un objeto.
const jar = vi.hoisted(() => ({ cookies: {} as Record<string, string> }))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name in jar.cookies ? { name, value: jar.cookies[name] } : undefined),
    set: (name: string, value: string) => {
      jar.cookies[name] = value
    },
    delete: (name: string) => {
      delete jar.cookies[name]
    },
  }),
}))

beforeAll(() => {
  vi.stubEnv("JWT_SECRET", "secreto-de-test-con-longitud-suficiente")
})

beforeEach(async () => {
  await resetDb()
  jar.cookies = {}
  vi.spyOn(console, "error").mockImplementation(() => {})
})

// Cada test usa una IP distinta: el rate limit en memoria se comparte en el archivo.
let ip = 0
function post(path: string, body: unknown, cookies: Record<string, string> = {}, ipFija?: string) {
  const request = new NextRequest(`http://localhost${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": ipFija ?? `10.0.0.${++ip}` },
  })
  for (const [k, v] of Object.entries(cookies)) request.cookies.set(k, v)
  return request
}
const ctx = { params: Promise.resolve({}) }

async function crearAdmin() {
  const [rol] = await db.insert(roles).values({ nombre: "administrador" }).returning()
  const [u] = await db
    .insert(usuarios)
    .values({
      nombre: "Ana",
      email: "ana@test.local",
      hash_password: await hashPassword("clave-correcta"),
      rol_id: rol.id,
    })
    .returning()
  return u
}

describe("rutas de login y logout del admin", () => {
  test("login correcto pone la cookie; logout la borra y revoca el token", async () => {
    await crearAdmin()
    const res = await loginAdmin(post("/api/auth/login", { email: "ANA@test.local", password: "clave-correcta" }), ctx)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, user: { email: "ana@test.local", rol: "administrador" } })
    const token = jar.cookies["auth-token"]
    expect(token).toBeDefined()
    expect(await getCurrentUser()).toMatchObject({ email: "ana@test.local" })

    const out = await logoutAdmin(post("/api/auth/logout", {}, { "auth-token": token }), ctx)
    expect(out.status).toBe(200)
    expect(jar.cookies["auth-token"]).toBeUndefined()

    // El mismo token, copiado antes del logout, ya no vale.
    jar.cookies["auth-token"] = token
    expect(await getCurrentUser()).toBeNull()
  })

  test("body incompleto → 400; credenciales malas → 401 genérico sin cookie", async () => {
    await crearAdmin()
    const incompleto = await loginAdmin(post("/api/auth/login", { email: "ana@test.local" }), ctx)
    expect(incompleto.status).toBe(400)

    const malo = await loginAdmin(post("/api/auth/login", { email: "ana@test.local", password: "x" }), ctx)
    expect(malo.status).toBe(401)
    expect(await malo.json()).toEqual({ error: "Credenciales inválidas" })
    expect(jar.cookies["auth-token"]).toBeUndefined()
  })

  test("rate limit del login admin: 429 tras 10 intentos desde la misma IP", async () => {
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) {
      const body = { email: "x@test.local", password: "x" }
      const res = await loginAdmin(post("/api/auth/login", body, {}, "10.9.9.9"), ctx)
      statuses.push(res.status)
    }
    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true)
    expect(statuses[10]).toBe(429)
  })
})

describe("rutas de login y logout del portal", () => {
  test("login y logout revocan el token del portal", async () => {
    await crearCliente({ email: "cli@test.local", hash_password: await hashPassword("secreta") })
    const res = await loginPortal(post("/api/portal/login", { email: "cli@test.local", password: "secreta" }), ctx)
    expect(res.status).toBe(200)
    const token = jar.cookies["portal-auth-token"]
    expect(await getClienteFromToken()).toMatchObject({ email: "cli@test.local" })

    await logoutPortal(post("/api/portal/logout", {}, { "portal-auth-token": token }), ctx)
    expect(jar.cookies["portal-auth-token"]).toBeUndefined()
    jar.cookies["portal-auth-token"] = token
    expect(await getClienteFromToken()).toBeNull()
  })
})

describe("POST público de tickets", () => {
  test("no acepta tickets de reseteo de contraseña", async () => {
    const res = await crearTicketPublico(
      post("/api/soporte/tickets", { tipo: "reseteo_contraseña", descripcion: "dame el enlace" }),
      ctx,
    )
    expect(res.status).toBe(400)
    expect(await db.select().from(tickets)).toHaveLength(0)
  })

  test("crea tickets públicos válidos y limita por IP", async () => {
    const statuses: number[] = []
    for (let i = 0; i < 6; i++) {
      const res = await crearTicketPublico(
        post("/api/soporte/tickets", { tipo: "consulta", descripcion: `Pregunta ${i}` }, {}, "10.8.8.8"),
        ctx,
      )
      statuses.push(res.status)
    }
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429])
  })
})

describe("ruta de registro del portal", () => {
  test("201 con id y nombre, sin el email; los choques responden el mismo 400 genérico", async () => {
    await crearCliente({ cedula: "0933333333", email: "duena@test.local", telefono: "0994444444" })
    const body = {
      nombre: "Nueva Persona",
      cedula: "0944444444",
      email: "nueva@test.local",
      telefono: "0995555555",
      password: "secreta",
    }

    const ok = await registroPortal(post("/api/portal/registro", body), ctx)
    expect(ok.status).toBe(201)
    const { cliente } = await ok.json()
    expect(Object.keys(cliente).sort()).toEqual(["id", "nombre"])

    const generico = { error: "No se pudo completar el registro, contacta a la tienda" }
    const emailRepetido = await registroPortal(post("/api/portal/registro", { ...body, cedula: "0955555555" }), ctx)
    expect([emailRepetido.status, await emailRepetido.json()]).toEqual([400, generico])
    const cedulaConCuenta = await registroPortal(post("/api/portal/registro", { ...body, email: "otra@test.local" }), ctx)
    expect([cedulaConCuenta.status, await cedulaConCuenta.json()]).toEqual([400, generico])
  })
})
