import { beforeEach, describe, expect, test, vi } from "vitest"
import { createHash } from "node:crypto"
import { eq } from "drizzle-orm"
import { hashPassword, verifyPassword } from "@/lib/password"
import { db } from "@/server/db/client"
import { auditoria, clientes, roles, tickets, usuarios } from "@/server/db/schema"
import { iniciarSesionAdmin } from "@/server/services/auth"
import {
  cambiarPasswordCliente,
  iniciarSesionCliente,
  registrarCliente,
  resetearPasswordConToken,
  solicitarReseteoCliente,
} from "@/server/services/portal-auth"
import { loginBody, registroBody } from "@/server/validators/auth"
import { resetDb } from "../support/db-client"
import { crearCliente } from "../support/fixtures"

beforeEach(async () => {
  await resetDb()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

const login = (email: string, password: string) => loginBody.parse({ email, password })

async function crearAdmin(datos: Partial<typeof usuarios.$inferInsert> = {}) {
  const [rol] = await db.insert(roles).values({ nombre: "administrador" }).returning()
  const [u] = await db
    .insert(usuarios)
    .values({
      nombre: "Ana",
      email: "ana@test.local",
      hash_password: await hashPassword("clave-correcta"),
      rol_id: rol.id,
      ...datos,
    })
    .returning()
  return u
}

async function accionesAuditadas() {
  return (await db.select({ accion: auditoria.accion }).from(auditoria)).map((a) => a.accion)
}

async function filaCliente(id: number) {
  const [c] = await db.select().from(clientes).where(eq(clientes.id, id))
  return c
}

describe("validadores de auth", () => {
  test("normalizan el email (trim + minúsculas)", () => {
    expect(login("  Ana@Test.LOCAL ", "x").email).toBe("ana@test.local")
    const r = registroBody.parse({
      nombre: "Ana",
      cedula: "0912345678",
      email: " Ana@Test.Local",
      password: "secreta",
    })
    expect(r.email).toBe("ana@test.local")
    expect(r.telefono).toBeNull()
  })

  test("exigen los campos", () => {
    expect(() => loginBody.parse({ email: "a@b.c" })).toThrow("Email y contraseña son requeridos")
    expect(() => registroBody.parse({ nombre: "A", cedula: "1", email: "a@b.c", password: "123" })).toThrow(
      "La contraseña debe tener al menos 6 caracteres",
    )
  })
})

describe("login del panel admin", () => {
  test("credenciales correctas, con el email en otra capitalización", async () => {
    const u = await crearAdmin()
    const r = await iniciarSesionAdmin(login("ANA@test.local", "clave-correcta"))
    expect(r).toMatchObject({ ok: true, tokenVersion: 0, sesion: { id: u.id, rol: "administrador" } })
    expect(await accionesAuditadas()).toEqual(["login_exitoso"])
  })

  test("encuentra filas antiguas guardadas con mayúsculas", async () => {
    await crearAdmin({ email: "Ana@Test.Local" })
    expect((await iniciarSesionAdmin(login("ana@test.local", "clave-correcta"))).ok).toBe(true)
  })

  test("contraseña incorrecta o usuario inexistente: 401 y queda en la auditoría", async () => {
    await crearAdmin()
    expect(await iniciarSesionAdmin(login("ana@test.local", "otra"))).toMatchObject({ ok: false, status: 401 })
    expect(await iniciarSesionAdmin(login("nadie@test.local", "otra"))).toMatchObject({ ok: false, status: 401 })
    expect(await accionesAuditadas()).toEqual(["login_password_incorrecto", "login_fallido"])
  })

  test("usuario inactivo: no inicia sesión", async () => {
    await crearAdmin({ activo: false })
    expect((await iniciarSesionAdmin(login("ana@test.local", "clave-correcta"))).ok).toBe(false)
    expect(await accionesAuditadas()).toEqual(["login_usuario_inactivo"])
  })
})

describe("login del portal", () => {
  test("credenciales correctas: devuelve la sesión y marca el último acceso", async () => {
    const c = await crearCliente({ email: "cli@test.local", hash_password: await hashPassword("secreta") })
    const r = await iniciarSesionCliente(login("Cli@Test.local", "secreta"))
    expect(r).toMatchObject({ ok: true, sesion: { id: c.id, email: "cli@test.local" } })
    expect((await filaCliente(c.id)).ultimo_acceso).not.toBeNull()
  })

  test("contraseña incorrecta, inactivo o sin contraseña: no inicia sesión", async () => {
    await crearCliente({ email: "a@test.local", hash_password: await hashPassword("secreta") })
    await crearCliente({ email: "b@test.local", hash_password: await hashPassword("secreta"), activo: false })
    await crearCliente({ email: "c@test.local" })
    expect((await iniciarSesionCliente(login("a@test.local", "mala"))).ok).toBe(false)
    expect((await iniciarSesionCliente(login("b@test.local", "secreta"))).ok).toBe(false)
    expect((await iniciarSesionCliente(login("c@test.local", "secreta"))).ok).toBe(false)
    expect((await iniciarSesionCliente(login("x@test.local", "secreta"))).ok).toBe(false)
  })
})

describe("registro en el portal", () => {
  const datos = (extra: Record<string, unknown> = {}) =>
    registroBody.parse({
      nombre: "Nueva",
      cedula: "0911111111",
      email: "Nueva@Test.Local",
      telefono: "0991111111",
      password: "secreta",
      ...extra,
    })

  test("crea el cliente con el email normalizado y la contraseña hasheada", async () => {
    const cliente = await registrarCliente(datos())
    const fila = await filaCliente(cliente.id)
    expect(fila.email).toBe("nueva@test.local")
    expect(fila.cedula).toBe("0911111111")
    expect(await verifyPassword("secreta", fila.hash_password!)).toBe(true)
  })

  test("rechaza un email ya registrado aunque cambie la capitalización", async () => {
    await crearCliente({ email: "Nueva@test.local" })
    await expect(registrarCliente(datos())).rejects.toMatchObject({ status: 400 })
  })

  test("rechaza una cédula que ya tiene cuenta", async () => {
    await crearCliente({ cedula: "0911111111", email: "otra@test.local", hash_password: "x" })
    await expect(registrarCliente(datos())).rejects.toMatchObject({ status: 400 })
  })
})

describe("recuperar y resetear la contraseña del portal", () => {
  async function tokenDelTicket() {
    const [ticket] = await db.select().from(tickets)
    const token = /token=([0-9a-f]{64})/.exec(decodeURIComponent(ticket.descripcion))?.[1]
    expect(token).toBeDefined()
    return { ticket, token: token! }
  }

  test("email inexistente: no crea ticket ni falla", async () => {
    await solicitarReseteoCliente("nadie@test.local", "https://tienda.test")
    expect(await db.select().from(tickets)).toHaveLength(0)
  })

  test("crea el ticket con el enlace y guarda solo el hash del token", async () => {
    const c = await crearCliente({ email: "cli@test.local", hash_password: await hashPassword("vieja1") })
    await solicitarReseteoCliente("cli@test.local", "https://tienda.test")

    const { ticket, token } = await tokenDelTicket()
    expect(ticket).toMatchObject({ tipo: "reseteo_contraseña", prioridad: "alta", estado: "pendiente" })
    expect(ticket.descripcion).toContain("wa.me/")
    const fila = await filaCliente(c.id)
    expect(fila.reset_token).toBe(createHash("sha256").update(token).digest("hex"))
    expect(fila.reset_token).not.toBe(token)
  })

  test("el enlace resetea la contraseña una sola vez e invalida las sesiones", async () => {
    const c = await crearCliente({ email: "cli@test.local", hash_password: await hashPassword("vieja1") })
    await solicitarReseteoCliente("cli@test.local", "https://tienda.test")
    const { token } = await tokenDelTicket()

    await resetearPasswordConToken(token, "nueva-clave")
    const fila = await filaCliente(c.id)
    expect(await verifyPassword("nueva-clave", fila.hash_password!)).toBe(true)
    expect(fila.reset_token).toBeNull()
    expect(fila.token_version).toBe(1)

    await expect(resetearPasswordConToken(token, "otra-clave")).rejects.toMatchObject({ status: 400 })
  })

  test("un enlace vencido no sirve", async () => {
    const c = await crearCliente({ email: "cli@test.local" })
    await solicitarReseteoCliente("cli@test.local", "https://tienda.test")
    const { token } = await tokenDelTicket()
    await db.update(clientes).set({ reset_token_expiry: new Date(Date.now() - 1000) }).where(eq(clientes.id, c.id))

    await expect(resetearPasswordConToken(token, "nueva-clave")).rejects.toMatchObject({
      status: 400,
      message: "El enlace ha expirado. Solicita uno nuevo.",
    })
  })
})

describe("cambiar la contraseña desde el portal", () => {
  test("exige la contraseña actual", async () => {
    const c = await crearCliente({ hash_password: await hashPassword("actual1") })
    await expect(cambiarPasswordCliente(c.id, "mala", "nueva-clave")).rejects.toMatchObject({ status: 401 })
    expect((await filaCliente(c.id)).token_version).toBe(0)
  })

  test("cambia la contraseña e incrementa token_version", async () => {
    const c = await crearCliente({ hash_password: await hashPassword("actual1") })
    expect(await cambiarPasswordCliente(c.id, "actual1", "nueva-clave")).toBe(1)
    expect(await verifyPassword("nueva-clave", (await filaCliente(c.id)).hash_password!)).toBe(true)
  })
})
