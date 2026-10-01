import { beforeEach, describe, expect, test, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import type { UserPayload } from "@/lib/auth"
import { HttpError } from "@/lib/http"
import { withAuth } from "@/server/auth/guard"

// withAuth lee el usuario de la cookie con lib/auth; aquí se controla a mano.
// (vi.mock se eleva por encima de los imports.)
const auth = vi.hoisted(() => ({ user: null as UserPayload | null }))
vi.mock("@/lib/auth", () => ({
  getCurrentUser: async () => auth.user,
  getClienteFromToken: async () => null,
}))

const asistente: UserPayload = { id: 2, email: "a@test.local", nombre: "A", rol: "asistente", rol_id: 2 }
const request = new NextRequest("http://localhost/api/test")
const context = { params: Promise.resolve({}) }

beforeEach(() => {
  auth.user = null
  vi.spyOn(console, "error").mockImplementation(() => {})
})

async function responder(handler: () => Promise<Response>, module: "pedidos" | "nomina" = "pedidos") {
  const route = withAuth({ permission: { module, action: "create" }, error: "Error al crear" }, handler)
  const res = await route(request, context)
  return { status: res.status, body: await res.json() }
}

describe("withAuth", () => {
  test("sin sesión → 401 sin ejecutar el handler", async () => {
    const handler = vi.fn()
    expect(await responder(handler)).toEqual({ status: 401, body: { error: "No autenticado" } })
    expect(handler).not.toHaveBeenCalled()
  })

  test("sin permiso → 403", async () => {
    auth.user = asistente
    const handler = vi.fn()
    expect((await responder(handler, "nomina")).status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
  })

  test("con permiso → ejecuta el handler con el usuario", async () => {
    auth.user = asistente
    const res = await responder(async () => NextResponse.json({ ok: true }, { status: 201 }))
    expect(res).toEqual({ status: 201, body: { ok: true } })
  })

  test("error de Zod → 400 con el primer mensaje", async () => {
    auth.user = asistente
    const res = await responder(async () => {
      z.object({ monto: z.number({ error: "El monto es requerido" }) }).parse({})
      return NextResponse.json({})
    })
    expect(res).toEqual({ status: 400, body: { error: "El monto es requerido" } })
  })

  test("HttpError → su status y mensaje", async () => {
    auth.user = asistente
    const res = await responder(async () => {
      throw new HttpError(409, "Ya existe")
    })
    expect(res).toEqual({ status: 409, body: { error: "Ya existe" } })
  })

  test("error interno → 500 genérico, sin filtrar el detalle", async () => {
    auth.user = asistente
    const res = await responder(async () => {
      throw new Error('relation "pedidos" does not exist')
    })
    expect(res).toEqual({ status: 500, body: { error: "Error al crear" } })
    expect(JSON.stringify(res.body)).not.toContain("relation")
  })
})
