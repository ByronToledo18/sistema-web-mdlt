import { beforeEach, describe, expect, test } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/server/db/client"
import { roles, usuarios } from "@/server/db/schema"
import { alternarEstadoUsuario, cambiarRolUsuario, eliminarUsuario } from "@/server/services/usuarios"
import { resetDb } from "../support/db-client"

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

    await expect(alternarEstadoUsuario(admin.id)).rejects.toMatchObject({ status: 400 })
    await expect(eliminarUsuario(admin.id)).rejects.toMatchObject({ status: 400 })
    await expect(cambiarRolUsuario(admin.id, r.asistente)).rejects.toMatchObject({ status: 400 })
    expect(await activos()).toBe(1)
  })

  test("con dos administradores, uno sí se puede desactivar", async () => {
    const r = await crearRoles()
    const a = await crearUsuario(r.administrador)
    await crearUsuario(r.administrador)

    expect(await alternarEstadoUsuario(a.id)).toBe(false)
    expect(await activos()).toBe(1)
  })

  test("dos administradores desactivándose a la vez: queda uno activo", async () => {
    const r = await crearRoles()
    const a = await crearUsuario(r.administrador)
    const b = await crearUsuario(r.administrador)

    const resultados = await Promise.allSettled([alternarEstadoUsuario(a.id), alternarEstadoUsuario(b.id)])

    expect(resultados.map((x) => x.status).sort()).toEqual(["fulfilled", "rejected"])
    expect(await activos()).toBe(1)
  })

  test("el último de soporte también está protegido; un asistente no", async () => {
    const r = await crearRoles()
    const soporte = await crearUsuario(r.soporte)
    const asistente = await crearUsuario(r.asistente)

    await expect(alternarEstadoUsuario(soporte.id)).rejects.toMatchObject({ status: 400 })
    await expect(eliminarUsuario(asistente.id)).resolves.toMatchObject({ id: asistente.id })
  })
})
