import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"
import { getClienteFromToken, getCurrentUser } from "@/lib/auth"
import { generatePortalToken, generateToken } from "@/lib/jwt"
import { adminAction } from "@/server/auth/action"
import { withAuth, withCliente } from "@/server/auth/guard"
import { db } from "@/server/db/client"
import { clientes, roles, usuarios } from "@/server/db/schema"
import { alternarEstadoCliente } from "@/server/services/clientes"
import { alternarEstadoUsuario, cambiarRolUsuario, resetearPasswordUsuario } from "@/server/services/usuarios"
import { resetDb } from "../support/db-client"
import { crearCliente } from "../support/fixtures"

// lib/auth lee las cookies con next/headers; aquí se controlan a mano. El
// resto (JWT, BD, guard, adminAction) es el código real contra PGlite.
const jar = vi.hoisted(() => ({ cookies: {} as Record<string, string> }))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name in jar.cookies ? { name, value: jar.cookies[name] } : undefined),
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

async function crearRoles() {
  const filas = await db
    .insert(roles)
    .values([{ nombre: "administrador" }, { nombre: "asistente" }, { nombre: "soporte" }])
    .returning()
  return Object.fromEntries(filas.map((r) => [r.nombre, r.id])) as Record<string, number>
}

let n = 0
async function crearUsuario(rol_id: number) {
  n++
  const [u] = await db
    .insert(usuarios)
    .values({ nombre: `Usuario ${n}`, email: `u${n}@test.local`, hash_password: "x", rol_id })
    .returning()
  return u
}

async function tvUsuario(id: number) {
  const [u] = await db.select({ tv: usuarios.token_version }).from(usuarios).where(eq(usuarios.id, id))
  return u.tv
}

async function tvCliente(id: number) {
  const [c] = await db.select({ tv: clientes.token_version }).from(clientes).where(eq(clientes.id, id))
  return c.tv
}

// Inicia sesión de admin con la token_version actual del usuario.
async function loginAdmin(u: { id: number; email: string; nombre: string; rol_id: number }, rol: string) {
  jar.cookies["auth-token"] = await generateToken(
    { id: u.id, email: u.email, nombre: u.nombre, rol, rol_id: u.rol_id },
    await tvUsuario(u.id),
  )
}

async function loginPortal(c: { id: number; email: string | null; nombre: string }) {
  jar.cookies["portal-auth-token"] = await generatePortalToken(
    { id: c.id, email: c.email ?? "", nombre: c.nombre },
    await tvCliente(c.id),
  )
}

const request = new NextRequest("http://localhost/api/test")
const context = { params: Promise.resolve({}) }
const rutaAdmin = withAuth({ permission: null, error: "Error" }, async () => NextResponse.json({ ok: true }))
const rutaPortal = withCliente({ error: "Error" }, async () => NextResponse.json({ ok: true }))
const accionAdmin = () => adminAction({ permission: null, error: "Error" }, async () => "hecho")

describe("token_version en los servicios", () => {
  test("desactivar y reactivar un usuario incrementa token_version cada vez", async () => {
    const r = await crearRoles()
    await crearUsuario(r.administrador) // para que el otro no sea el último
    const u = await crearUsuario(r.asistente)

    await alternarEstadoUsuario(u.id)
    expect(await tvUsuario(u.id)).toBe(1)
    await alternarEstadoUsuario(u.id)
    expect(await tvUsuario(u.id)).toBe(2)
  })

  test("cambiar de rol incrementa token_version solo si el rol cambia", async () => {
    const r = await crearRoles()
    const u = await crearUsuario(r.asistente)

    await cambiarRolUsuario(u.id, r.asistente)
    expect(await tvUsuario(u.id)).toBe(0)
    await cambiarRolUsuario(u.id, r.soporte)
    expect(await tvUsuario(u.id)).toBe(1)
  })

  test("resetear la contraseña incrementa token_version", async () => {
    const r = await crearRoles()
    const u = await crearUsuario(r.asistente)

    await resetearPasswordUsuario(u.id, "nueva-clave")
    expect(await tvUsuario(u.id)).toBe(1)
  })

  test("desactivar y reactivar un cliente incrementa token_version cada vez", async () => {
    const c = await crearCliente()

    await alternarEstadoCliente(c.id)
    expect(await tvCliente(c.id)).toBe(1)
    await alternarEstadoCliente(c.id)
    expect(await tvCliente(c.id)).toBe(2)
  })
})

describe("revocación de sesiones del admin", () => {
  test("sesión válida: devuelve el usuario con el rol leído de la BD", async () => {
    const r = await crearRoles()
    const u = await crearUsuario(r.administrador)
    // El token dice "asistente", pero el rol vigente en la BD manda.
    await loginAdmin(u, "asistente")

    expect(await getCurrentUser()).toMatchObject({ id: u.id, rol: "administrador", rol_id: r.administrador })
  })

  test("desactivar al usuario invalida su sesión abierta, y reactivarlo no la revive", async () => {
    const r = await crearRoles()
    await crearUsuario(r.administrador)
    const u = await crearUsuario(r.asistente)
    await loginAdmin(u, "asistente")
    expect(await getCurrentUser()).not.toBeNull()

    await alternarEstadoUsuario(u.id)
    expect(await getCurrentUser()).toBeNull()
    expect((await rutaAdmin(request, context)).status).toBe(401)
    expect(await accionAdmin()).toEqual({ ok: false, error: "Tu sesión expiró. Vuelve a iniciar sesión." })

    await alternarEstadoUsuario(u.id)
    expect(await getCurrentUser()).toBeNull()
  })

  test("cambiar el rol o resetear la contraseña invalida la sesión abierta", async () => {
    const r = await crearRoles()
    const u = await crearUsuario(r.asistente)

    await loginAdmin(u, "asistente")
    await cambiarRolUsuario(u.id, r.soporte)
    expect(await getCurrentUser()).toBeNull()

    await loginAdmin(u, "soporte")
    expect(await getCurrentUser()).not.toBeNull()
    await resetearPasswordUsuario(u.id, "otra-clave")
    expect(await getCurrentUser()).toBeNull()
  })
})

describe("revocación de sesiones del portal", () => {
  test("desactivar al cliente invalida su sesión abierta", async () => {
    const c = await crearCliente()
    await loginPortal(c)
    expect(await getClienteFromToken()).toMatchObject({ id: c.id })
    expect((await rutaPortal(request, context)).status).toBe(200)

    await alternarEstadoCliente(c.id)
    expect(await getClienteFromToken()).toBeNull()
    expect((await rutaPortal(request, context)).status).toBe(401)
  })
})

describe("audiencias: un token no sirve en el área equivocada", () => {
  test("token del portal en la cookie del admin → 401 en withAuth y en adminAction", async () => {
    const r = await crearRoles()
    // Mismo id en ambas tablas, para que solo la audiencia los distinga.
    const u = await crearUsuario(r.administrador)
    const c = await crearCliente()
    expect(c.id).toBe(u.id)

    jar.cookies["auth-token"] = await generatePortalToken({ id: c.id, email: "x@test.local", nombre: c.nombre }, 0)

    expect(await getCurrentUser()).toBeNull()
    expect((await rutaAdmin(request, context)).status).toBe(401)
    expect(await accionAdmin()).toMatchObject({ ok: false })
  })

  test("token del admin en la cookie del portal → 401 en withCliente", async () => {
    const r = await crearRoles()
    const u = await crearUsuario(r.administrador)
    const c = await crearCliente()
    expect(c.id).toBe(u.id)

    jar.cookies["portal-auth-token"] = await generateToken(
      { id: u.id, email: u.email, nombre: u.nombre, rol: "administrador", rol_id: u.rol_id },
      0,
    )

    expect(await getClienteFromToken()).toBeNull()
    expect((await rutaPortal(request, context)).status).toBe(401)
  })

  test("token firmado con otro secreto → 401", async () => {
    const r = await crearRoles()
    const u = await crearUsuario(r.administrador)
    vi.stubEnv("JWT_SECRET", "otro-secreto")
    await loginAdmin(u, "administrador")
    vi.stubEnv("JWT_SECRET", "secreto-de-test-con-longitud-suficiente")

    expect(await getCurrentUser()).toBeNull()
  })
})
