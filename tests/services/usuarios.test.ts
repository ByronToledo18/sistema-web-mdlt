import { beforeEach, describe, expect, test } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/server/db/client"
import { roles, usuarios } from "@/server/db/schema"
import {
  alternarEstadoUsuario,
  cambiarRolUsuario,
  crearUsuario as crearUsuarioServicio,
  eliminarUsuario,
  resetearPasswordUsuario,
} from "@/server/services/usuarios"
import { resetDb } from "../support/db-client"

// Actor con todos los permisos: estos tests prueban las reglas del servicio,
// no los límites de soporte (ver "límites del rol soporte").
const ADMIN = { id: 0, rol: "administrador" }

beforeEach(resetDb)

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

async function activos() {
  return (await db.select().from(usuarios).where(eq(usuarios.activo, true))).length
}

describe("protección del último administrador / soporte", () => {
  test("no se puede desactivar, eliminar ni cambiar de rol al último administrador", async () => {
    const r = await crearRoles()
    const admin = await crearUsuario(r.administrador)

    await expect(alternarEstadoUsuario(ADMIN, admin.id)).rejects.toMatchObject({ status: 400 })
    await expect(eliminarUsuario(ADMIN, admin.id)).rejects.toMatchObject({ status: 400 })
    await expect(cambiarRolUsuario(ADMIN, admin.id, r.asistente)).rejects.toMatchObject({ status: 400 })
    expect(await activos()).toBe(1)
  })

  test("con dos administradores, uno sí se puede desactivar", async () => {
    const r = await crearRoles()
    const a = await crearUsuario(r.administrador)
    await crearUsuario(r.administrador)

    expect(await alternarEstadoUsuario(ADMIN, a.id)).toBe(false)
    expect(await activos()).toBe(1)
  })

  test("dos administradores desactivándose a la vez: queda uno activo", async () => {
    const r = await crearRoles()
    const a = await crearUsuario(r.administrador)
    const b = await crearUsuario(r.administrador)

    const resultados = await Promise.allSettled([
      alternarEstadoUsuario(ADMIN, a.id),
      alternarEstadoUsuario(ADMIN, b.id),
    ])

    expect(resultados.map((x) => x.status).sort()).toEqual(["fulfilled", "rejected"])
    expect(await activos()).toBe(1)
  })

  test("el último de soporte también está protegido; un asistente no", async () => {
    const r = await crearRoles()
    const soporte = await crearUsuario(r.soporte)
    const asistente = await crearUsuario(r.asistente)

    await expect(alternarEstadoUsuario(ADMIN, soporte.id)).rejects.toMatchObject({ status: 400 })
    await expect(eliminarUsuario(ADMIN, asistente.id)).resolves.toMatchObject({ id: asistente.id })
  })
})

describe("límites del rol soporte", () => {
  async function escenario() {
    const r = await crearRoles()
    const admin1 = await crearUsuario(r.administrador)
    const admin2 = await crearUsuario(r.administrador)
    const sop = await crearUsuario(r.soporte)
    await crearUsuario(r.soporte) // para que `sop` no sea el último de soporte
    const asis = await crearUsuario(r.asistente)
    return {
      r,
      admin1,
      admin2,
      sop,
      asis,
      actor: { id: sop.id, rol: "soporte" },
    }
  }

  async function rolDe(id: number) {
    const [u] = await db
      .select({
        rol_id: usuarios.rol_id,
        hash: usuarios.hash_password,
        activo: usuarios.activo,
      })
      .from(usuarios)
      .where(eq(usuarios.id, id))
    return u
  }

  test("soporte puede crear un usuario administrador", async () => {
    const { r } = await escenario()
    const nuevo = await crearUsuarioServicio({
      nombre: "Nuevo",
      email: "nuevo@test.local",
      password: "secreta",
      rol_id: r.administrador,
    })
    expect((await rolDe(nuevo.id)).rol_id).toBe(r.administrador)
  })

  test("soporte no puede cambiar su propio rol", async () => {
    const { r, sop, actor } = await escenario()
    await expect(cambiarRolUsuario(actor, sop.id, r.administrador)).rejects.toMatchObject({
      status: 403,
      message: "No puedes cambiar tu propio rol",
    })
    await expect(cambiarRolUsuario(actor, sop.id, r.asistente)).rejects.toMatchObject({ status: 403 })
    expect((await rolDe(sop.id)).rol_id).toBe(r.soporte)
  })

  test("soporte no puede cambiar el rol de un administrador", async () => {
    const { r, admin1, actor } = await escenario()
    await expect(cambiarRolUsuario(actor, admin1.id, r.asistente)).rejects.toMatchObject({ status: 403 })
    expect((await rolDe(admin1.id)).rol_id).toBe(r.administrador)
  })

  test("soporte no puede dar el rol administrador a un usuario existente", async () => {
    const { r, asis, actor } = await escenario()
    await expect(cambiarRolUsuario(actor, asis.id, r.administrador)).rejects.toMatchObject({ status: 403 })
    expect((await rolDe(asis.id)).rol_id).toBe(r.asistente)
  })

  test("soporte sí puede cambiar roles que no involucran al administrador", async () => {
    const { r, asis, actor } = await escenario()
    await cambiarRolUsuario(actor, asis.id, r.soporte)
    expect((await rolDe(asis.id)).rol_id).toBe(r.soporte)
  })

  test("soporte no puede resetear la contraseña ni desactivar o eliminar a un administrador", async () => {
    const { admin1, actor } = await escenario()
    await expect(resetearPasswordUsuario(actor, admin1.id, "otra-clave")).rejects.toMatchObject({ status: 403 })
    await expect(alternarEstadoUsuario(actor, admin1.id)).rejects.toMatchObject({ status: 403 })
    await expect(eliminarUsuario(actor, admin1.id)).rejects.toMatchObject({
      status: 403,
    })
    const fila = await rolDe(admin1.id)
    expect(fila.hash).toBe("x")
    expect(fila.activo).toBe(true)
  })

  test("soporte sí puede resetear y desactivar a un asistente", async () => {
    const { asis, actor } = await escenario()
    await resetearPasswordUsuario(actor, asis.id, "otra-clave")
    expect(await alternarEstadoUsuario(actor, asis.id)).toBe(false)
  })

  test("el administrador no tiene restricciones", async () => {
    const { r, admin1, admin2, asis } = await escenario()
    const actor = { id: admin1.id, rol: "administrador" }
    await resetearPasswordUsuario(actor, admin2.id, "otra-clave")
    await cambiarRolUsuario(actor, asis.id, r.administrador)
    await cambiarRolUsuario(actor, admin2.id, r.asistente)
    expect(await alternarEstadoUsuario(actor, admin2.id)).toBe(false)
  })
})
