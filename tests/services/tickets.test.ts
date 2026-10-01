import { beforeEach, describe, expect, test } from "vitest"
import { db } from "@/server/db/client"
import { roles, tickets, usuarios } from "@/server/db/schema"
import { crearTicket, solicitarReseteoAdmin } from "@/server/services/usuarios"
import { crearTicketBody, solicitarReseteoAdminBody } from "@/server/validators/usuarios"
import { resetDb } from "../support/db-client"

beforeEach(resetDb)

describe("POST público de tickets (crearTicketBody)", () => {
  test("acepta los tipos públicos y pone prioridad media por defecto", () => {
    expect(crearTicketBody.parse({ tipo: "consulta", descripcion: " Hola " })).toEqual({
      tipo: "consulta",
      prioridad: "media",
      descripcion: "Hola",
      email_contacto: null,
    })
  })

  test("no permite crear tickets de reseteo de contraseña ni tipos inventados", () => {
    expect(() => crearTicketBody.parse({ tipo: "reseteo_contraseña", descripcion: "x" })).toThrow(
      "Tipo de ticket inválido",
    )
    expect(() => crearTicketBody.parse({ tipo: "lo_que_sea", descripcion: "x" })).toThrow("Tipo de ticket inválido")
  })

  test("limita prioridad, longitud y formato del email", () => {
    expect(() => crearTicketBody.parse({ tipo: "otro", prioridad: "urgentisima", descripcion: "x" })).toThrow(
      "Prioridad inválida",
    )
    expect(() => crearTicketBody.parse({ tipo: "otro", descripcion: "x".repeat(2001) })).toThrow(
      "La descripción es demasiado larga",
    )
    expect(() => crearTicketBody.parse({ tipo: "otro", descripcion: "x", email_contacto: "no-es-email" })).toThrow(
      "Email inválido",
    )
    expect(() => crearTicketBody.parse({ tipo: "otro", descripcion: "  " })).toThrow("La descripción es requerida")
  })

  test("crea el ticket pendiente", async () => {
    const t = await crearTicket(crearTicketBody.parse({ tipo: "soporte_tecnico", descripcion: "No carga" }))
    expect(t).toMatchObject({ tipo: "soporte_tecnico", prioridad: "media", estado: "pendiente" })
  })
})

describe("solicitud de reseteo del login admin", () => {
  async function crearUsuarioAdmin(activo = true) {
    const [rol] = await db.insert(roles).values({ nombre: "asistente" }).returning()
    await db
      .insert(usuarios)
      .values({ nombre: "Ana", email: "ana@test.local", hash_password: "x", rol_id: rol.id, activo })
  }

  const solicitud = (email: string, mensaje?: string) => solicitarReseteoAdminBody.parse({ email, mensaje })

  test("crea el ticket de reseteo para un usuario activo (email normalizado)", async () => {
    await crearUsuarioAdmin()
    expect(await solicitarReseteoAdmin(solicitud(" ANA@test.local", "No recuerdo la clave"))).toBe(true)

    const [t] = await db.select().from(tickets)
    expect(t).toMatchObject({ tipo: "reseteo_contraseña", prioridad: "alta", email_contacto: "ana@test.local" })
    expect(t.descripcion).toContain("Ana (ana@test.local)")
    expect(t.descripcion).toContain("No recuerdo la clave")
  })

  test("email inexistente o usuario inactivo: no crea nada", async () => {
    await crearUsuarioAdmin(false)
    expect(await solicitarReseteoAdmin(solicitud("ana@test.local"))).toBe(false)
    expect(await solicitarReseteoAdmin(solicitud("nadie@test.local"))).toBe(false)
    expect(await db.select().from(tickets)).toHaveLength(0)
  })
})
