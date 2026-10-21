import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { eq, sql } from "drizzle-orm"
import type { UserPayload } from "@/lib/auth"
import { db } from "@/server/db/client"
import { auditoria, envios, pedidoItems, pedidos, roles, servientregaRotulos, usuarios } from "@/server/db/schema"
import { ServientregaError } from "@/server/integraciones/servientrega/errores"
import { crearEnvio, eliminarEnvio } from "@/server/services/envios"
import { crearPedido, listarPedidosDeCliente } from "@/server/services/pedidos"
import {
  actualizarEstadoGuia,
  anularGuiaServientrega,
  descargarGuia,
  formularioGuiaServientrega,
  generarGuiaServientrega,
} from "@/server/services/servientrega"
import { resetDb } from "../support/db-client"
import { admin, asistente, crearCliente, crearServicioEnvio } from "../support/fixtures"

// El cliente HTTP de Servientrega se reemplaza por este doble: ningún test
// llama a la API real.
const api = vi.hoisted(() => ({
  ambiente: "qa" as const,
  listarCiudades: vi.fn(),
  generarGuia: vi.fn(),
  anularGuia: vi.fn(),
  obtenerPdfGuia: vi.fn(),
  obtenerRotulo: vi.fn(),
  consultarTrazabilidad: vi.fn(),
}))

vi.mock("@/server/integraciones/servientrega/cliente", () => ({
  crearClienteServientrega: () => api,
}))


const soporte: UserPayload = { id: 3, email: "soporte@test.local", nombre: "Soporte", rol: "soporte", rol_id: 3 }

const ENV = {
  SERVIENTREGA_AMBIENTE: "qa",
  SERVIENTREGA_USUARIO: "usuario-test",
  SERVIENTREGA_PASSWORD: "clave-test",
  SERVIENTREGA_REMITENTE_ID: "0999999999001",
  SERVIENTREGA_REMITENTE_RAZON_SOCIAL: "El Mundo de las Tutus",
  SERVIENTREGA_REMITENTE_NOMBRE: "Ana",
  SERVIENTREGA_REMITENTE_APELLIDO: "Pérez",
  SERVIENTREGA_REMITENTE_DIRECCION: "Av. Uno 1",
  SERVIENTREGA_REMITENTE_TELEFONO: "0988888888",
  SERVIENTREGA_REMITENTE_CIUDAD_ID: "1",
}

const PDF = Buffer.from("%PDF-1.7 prueba")

const datosGuia = {
  ciudad_destino_id: 2,
  destinatario_identificacion: "0911223344",
  destinatario_nombre: "María José López Vera",
  destinatario_direccion: "Calle Dos 2",
  destinatario_telefono: "0999999999",
  peso_kg: "0.5",
  piezas: "1",
  contenido: "Tutú / prendas",
  valor_mercancia: "25",
  producto_id: "2",
}

let numeroGuia = 709533700

beforeEach(async () => {
  await resetDb()
  vi.resetAllMocks()
  numeroGuia = 709533700
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v)
  api.listarCiudades.mockResolvedValue([
    { id: 2, nombre: "QUITO (PICHINCHA)" },
    { id: 1, nombre: "GUAYAQUIL (GUAYAS)" },
  ])
  api.generarGuia.mockImplementation(async () => ({ numero: String(numeroGuia++), mensaje: "GUÍA REGISTRADA CORRECTAMENTE" }))
  api.anularGuia.mockResolvedValue({ mensaje: "GUÍA ANULADA" })
  api.obtenerPdfGuia.mockResolvedValue(PDF)
  api.obtenerRotulo.mockResolvedValue(PDF)
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "info").mockImplementation(() => {})
  // Usuarios reales para que la auditoría (FK usuario_id) se pueda guardar.
  const [rol] = await db.insert(roles).values({ nombre: "administrador" }).returning()
  await db.insert(usuarios).values([
    { nombre: "Admin", email: "admin@test.local", hash_password: "x", rol_id: rol.id },
    { nombre: "Asistente", email: "asistente@test.local", hash_password: "x", rol_id: rol.id },
  ])
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

async function nuevoEnvio(datosCliente: Parameters<typeof crearCliente>[0] = {}) {
  const cliente = await crearCliente({ direccion: "Av. Amazonas y Colón, Quito", ...datosCliente })
  const pedido = await crearPedido(cliente.id)
  await crearServicioEnvio()
  return crearEnvio(admin, { pedido_id: pedido.id, costo: 4.5 })
}

async function envioEnBd(id: number) {
  const [e] = await db.select().from(envios).where(eq(envios.id, id))
  return e
}

describe("generarGuiaServientrega", () => {
  test("arma el payload con remitente, destinatario e input del admin y guarda la guía", async () => {
    const envio = await nuevoEnvio()
    const r = await generarGuiaServientrega(admin, envio.id, datosGuia)

    expect(r).toMatchObject({
      guia: envio.guia,
      guia_servientrega: "709533700",
      servientrega_estado: "generada",
      servientrega_ciudad_destino_id: 2,
      servientrega_producto_id: 2,
      peso_kg: "0.50",
      piezas: 1,
      contenido: "Tutú / prendas",
    })
    expect(r.guia_generada_at).toBeInstanceOf(Date)
    expect(api.generarGuia).toHaveBeenCalledWith(
      expect.objectContaining({
        ciudad_origen_id: 1,
        ciudad_destino_id: 2,
        remitente: expect.objectContaining({ identificacion: "0999999999001", razon_social: "El Mundo de las Tutus" }),
        destinatario: expect.objectContaining({
          identificacion: "0911223344",
          razon_social: "María José López Vera",
          nombre: "María José",
          apellido: "López Vera",
        }),
        producto_id: 2,
        peso_kg: 0.5,
        piezas: 1,
        valor_mercancia: 25,
        referencia_2: envio.guia,
      }),
    )

    const [log] = await db.select().from(auditoria).where(eq(auditoria.accion, "GENERAR_GUIA_SERVIENTREGA"))
    expect(log).toMatchObject({ usuario_id: admin.id, modulo: "envios" })
    expect(log.metadata).toMatchObject({ envio_id: envio.id, guia_servientrega: "709533700" })
  })

  test("no genera dos veces: con una guía vigente responde 409 sin llamar a la API", async () => {
    const envio = await nuevoEnvio()
    await generarGuiaServientrega(admin, envio.id, datosGuia)
    await expect(generarGuiaServientrega(admin, envio.id, datosGuia)).rejects.toMatchObject({ status: 409 })
    expect(api.generarGuia).toHaveBeenCalledTimes(1)
  })

  test("dos generaciones simultáneas: solo una llega a la API", async () => {
    const envio = await nuevoEnvio()
    const resultados = await Promise.allSettled([
      generarGuiaServientrega(admin, envio.id, datosGuia),
      generarGuiaServientrega(asistente, envio.id, datosGuia),
    ])
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    expect(resultados.find((r) => r.status === "rejected")).toMatchObject({ reason: { status: 409 } })
    expect(api.generarGuia).toHaveBeenCalledTimes(1)
  })

  test("una marca 'generando' reciente bloquea; una vencida permite reintentar", async () => {
    const envio = await nuevoEnvio()
    await db.update(envios).set({ servientrega_estado: "generando" }).where(eq(envios.id, envio.id))
    await expect(generarGuiaServientrega(admin, envio.id, datosGuia)).rejects.toMatchObject({ status: 409 })

    await db
      .update(envios)
      .set({ updated_at: sql`CURRENT_TIMESTAMP - interval '10 minutes'` })
      .where(eq(envios.id, envio.id))
    await expect(generarGuiaServientrega(admin, envio.id, datosGuia)).resolves.toMatchObject({
      servientrega_estado: "generada",
    })
  })

  test("si la API rechaza, el envío vuelve a su estado y se puede reintentar", async () => {
    const envio = await nuevoEnvio()
    api.generarGuia.mockRejectedValueOnce(new ServientregaError("rechazada", "CIUDAD DESTINO INVÁLIDA"))
    await expect(generarGuiaServientrega(admin, envio.id, datosGuia)).rejects.toMatchObject({
      status: 424,
      message: "Servientrega: CIUDAD DESTINO INVÁLIDA",
    })
    expect(await envioEnBd(envio.id)).toMatchObject({ servientrega_estado: null, guia_servientrega: null })

    await expect(generarGuiaServientrega(admin, envio.id, datosGuia)).resolves.toMatchObject({
      servientrega_estado: "generada",
    })
  })

  test("timeout: avisa que la guía pudo generarse igual y libera la marca", async () => {
    const envio = await nuevoEnvio()
    api.generarGuia.mockRejectedValueOnce(new ServientregaError("timeout", "Servientrega no respondió a tiempo"))
    const error = await generarGuiaServientrega(admin, envio.id, datosGuia).then(
      () => null,
      (e: unknown) => e as Error,
    )
    expect(error?.message).toMatch(/pudo haberse generado igual.*portal de Servientrega/)
    expect((await envioEnBd(envio.id)).servientrega_estado).toBeNull()
  })

  test("si la API responde OK pero falla el UPDATE, el número de guía queda en el log", async () => {
    const envio = await nuevoEnvio()
    api.generarGuia.mockImplementationOnce(async () => {
      // Otra operación borra la marca mientras se esperaba a Servientrega.
      await db.update(envios).set({ servientrega_estado: null }).where(eq(envios.id, envio.id))
      return { numero: "709599999", mensaje: "OK" }
    })
    await expect(generarGuiaServientrega(admin, envio.id, datosGuia)).rejects.toMatchObject({
      status: 424,
      message: expect.stringContaining("709599999"),
    })
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('"guia_servientrega":"709599999"'),
      expect.anything(),
    )
  })

  test("valida el formulario (producto inexistente, peso 0)", async () => {
    const envio = await nuevoEnvio()
    await expect(generarGuiaServientrega(admin, envio.id, { ...datosGuia, producto_id: "5" })).rejects.toThrow(
      /Producto/,
    )
    await expect(generarGuiaServientrega(admin, envio.id, { ...datosGuia, peso_kg: "0" })).rejects.toThrow(/peso/)
    expect(api.generarGuia).not.toHaveBeenCalled()
  })

  test("envío inexistente: 404", async () => {
    await expect(generarGuiaServientrega(admin, 999, datosGuia)).rejects.toMatchObject({ status: 404 })
  })
})

describe("anularGuiaServientrega", () => {
  test("anula, registra auditoría y permite generar una guía nueva", async () => {
    const envio = await nuevoEnvio()
    await generarGuiaServientrega(admin, envio.id, datosGuia)
    const anulado = await anularGuiaServientrega(admin, envio.id)
    expect(anulado).toMatchObject({ servientrega_estado: "anulada", guia_servientrega: "709533700" })
    expect(anulado?.guia_anulada_at).toBeInstanceOf(Date)
    expect(api.anularGuia).toHaveBeenCalledWith("709533700")
    expect(await db.select().from(auditoria).where(eq(auditoria.accion, "ANULAR_GUIA_SERVIENTREGA"))).toHaveLength(1)

    const nueva = await generarGuiaServientrega(admin, envio.id, datosGuia)
    expect(nueva).toMatchObject({ guia_servientrega: "709533701", servientrega_estado: "generada", guia_anulada_at: null })
  })

  test("si Servientrega rechaza la anulación, la guía sigue vigente", async () => {
    const envio = await nuevoEnvio()
    await generarGuiaServientrega(admin, envio.id, datosGuia)
    api.anularGuia.mockRejectedValueOnce(
      new ServientregaError("rechazada", "LA GUÍA NO PUEDE SER ANULADA, PORQUE ESTA SIENDO PROCESADA"),
    )
    await expect(anularGuiaServientrega(admin, envio.id)).rejects.toMatchObject({
      status: 424,
      message: expect.stringContaining("NO PUEDE SER ANULADA"),
    })
    expect((await envioEnBd(envio.id)).servientrega_estado).toBe("generada")
  })

  test("sin guía vigente: 409", async () => {
    const envio = await nuevoEnvio()
    await expect(anularGuiaServientrega(admin, envio.id)).rejects.toMatchObject({ status: 409 })
    expect(api.anularGuia).not.toHaveBeenCalled()
  })
})

describe("descargarGuia", () => {
  test("A4 siempre desde la API; el rótulo se guarda la primera vez", async () => {
    const envio = await nuevoEnvio()
    await generarGuiaServientrega(admin, envio.id, datosGuia)

    await expect(descargarGuia(envio.id, "a4")).resolves.toMatchObject({ numero: "709533700" })
    const r1 = await descargarGuia(envio.id, "rotulo")
    const r2 = await descargarGuia(envio.id, "rotulo")
    expect(r2.pdf.toString("base64")).toBe(r1.pdf.toString("base64"))
    expect(api.obtenerRotulo).toHaveBeenCalledTimes(1)
    expect(await db.select().from(servientregaRotulos)).toHaveLength(1)
  })

  test("rótulo ya entregado por Servientrega y sin copia: 409 con indicación", async () => {
    const envio = await nuevoEnvio()
    await generarGuiaServientrega(admin, envio.id, datosGuia)
    api.obtenerRotulo.mockRejectedValueOnce(new ServientregaError("rechazada", "YA SE ENCUENTRA IMPRESA POR RÓTULO"))
    await expect(descargarGuia(envio.id, "rotulo")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("guía A4"),
    })
  })

  test("sin guía vigente: 409", async () => {
    const envio = await nuevoEnvio()
    await expect(descargarGuia(envio.id, "a4")).rejects.toMatchObject({ status: 409 })
  })
})

describe("permisos", () => {
  test("soporte (sin módulo envíos) no genera ni anula; asistente sí", async () => {
    const envio = await nuevoEnvio()
    await expect(generarGuiaServientrega(soporte, envio.id, datosGuia)).rejects.toMatchObject({ status: 403 })
    await expect(formularioGuiaServientrega(soporte, envio.id)).rejects.toMatchObject({ status: 403 })
    await generarGuiaServientrega(asistente, envio.id, datosGuia)
    await expect(anularGuiaServientrega(soporte, envio.id)).rejects.toMatchObject({ status: 403 })
    await expect(anularGuiaServientrega(asistente, envio.id)).resolves.toMatchObject({ servientrega_estado: "anulada" })
    expect(api.generarGuia).toHaveBeenCalledTimes(1)
  })
})

describe("configuración faltante", () => {
  test("sin SERVIENTREGA_AMBIENTE: 400 'no configurada' y no se toca el envío", async () => {
    const envio = await nuevoEnvio()
    vi.stubEnv("SERVIENTREGA_AMBIENTE", "")
    await expect(generarGuiaServientrega(admin, envio.id, datosGuia)).rejects.toMatchObject({
      status: 400,
      message: "Integración con Servientrega no configurada",
    })
    await expect(formularioGuiaServientrega(admin, envio.id)).rejects.toMatchObject({ status: 400 })
    await expect(anularGuiaServientrega(admin, envio.id)).rejects.toMatchObject({ status: 400 })
    expect((await envioEnBd(envio.id)).servientrega_estado).toBeNull()
  })

  test("sin datos del remitente: 400 con las variables que faltan", async () => {
    const envio = await nuevoEnvio()
    vi.stubEnv("SERVIENTREGA_REMITENTE_DIRECCION", "")
    vi.stubEnv("SERVIENTREGA_REMITENTE_CIUDAD_ID", "")
    await expect(generarGuiaServientrega(admin, envio.id, datosGuia)).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/SERVIENTREGA_REMITENTE_DIRECCION, SERVIENTREGA_REMITENTE_CIUDAD_ID/),
    })
    expect(api.generarGuia).not.toHaveBeenCalled()
  })
})

describe("formularioGuiaServientrega", () => {
  test("precarga destinatario, sugiere la ciudad y usa el subtotal de productos", async () => {
    const envio = await nuevoEnvio({ nombre: "María López", cedula: "0911223344", telefono: "0991112233" })
    await db.update(pedidos).set({ ciudad_envio: "Quito" }).where(eq(pedidos.id, envio.pedido_id))
    await db.insert(pedidoItems).values({
      pedido_id: envio.pedido_id,
      item_tipo: "producto",
      item_id: 1,
      cantidad: "2",
      precio_unitario: "12.50",
      subtotal: "25.00",
    })

    const f = await formularioGuiaServientrega(admin, envio.id)
    expect(f).toMatchObject({
      ciudad_sugerida_id: 2,
      ciudad_pedido: "Quito",
      destinatario: {
        identificacion: "0911223344",
        nombre: "María López",
        direccion: "Av. Amazonas y Colón, Quito",
        telefono: "0991112233",
      },
      // Solo productos: el ítem de envío (4.50) no cuenta.
      valor_mercancia: 25,
      peso_kg: 0.5,
      piezas: 1,
      contenido: "Tutú / prendas",
      producto_id: 2,
    })
    expect(f.ciudades).toHaveLength(2)
  })
})

describe("eliminarEnvio", () => {
  test("no elimina un envío con guía vigente; sí después de anularla", async () => {
    const envio = await nuevoEnvio()
    await generarGuiaServientrega(admin, envio.id, datosGuia)
    await expect(eliminarEnvio(envio.id)).rejects.toMatchObject({ status: 400 })
    await anularGuiaServientrega(admin, envio.id)
    await descargarGuia(envio.id, "a4").catch(() => {})
    await expect(eliminarEnvio(envio.id)).resolves.toBeUndefined()
  })
})

describe("actualizarEstadoGuia (trazabilidad)", () => {
  const traz = (datos: Record<string, unknown> = {}) => ({
    numeroGuia: "709533700",
    estadoActual: "En Distribución a Cliente",
    idEstado: 4,
    fechaEstado: "2026-10-21",
    fechaProbable: "2026-10-22",
    fechaEnvio: "2026-10-20",
    ciudadOrigen: "GUAYAQUIL -GUAYAS",
    ciudadDestino: "QUITO -PICHINCHA",
    receptor: null,
    movimientos: [{ nombre: "Generado", origen: "GUAYAQUIL", descripcion: "Generado", fecha: "2026-10-20 10:00" }],
    mensajeImagen: null,
    sinDatos: false,
    ...datos,
  })

  test("guarda el estado actual y la fecha de consulta; devuelve movimientos y el enlace público", async () => {
    const envio = await nuevoEnvio()
    await generarGuiaServientrega(admin, envio.id, datosGuia)
    api.consultarTrazabilidad.mockResolvedValueOnce(traz())

    const r = await actualizarEstadoGuia(asistente, envio.id)
    expect(api.consultarTrazabilidad).toHaveBeenCalledWith("709533700")
    expect(r).toMatchObject({
      estado_actual: "En Distribución a Cliente",
      url_rastreo: "https://www.servientrega.com.ec/Tracking/?guia=709533700&tipo=GUIA",
      trazabilidad: { movimientos: [{ nombre: "Generado" }] },
    })
    const enBd = await envioEnBd(envio.id)
    expect(enBd.servientrega_estado_actual).toBe("En Distribución a Cliente")
    expect(enBd.servientrega_consultado_at).toBeInstanceOf(Date)
  })

  test("sin datos en Servientrega: conserva el último estado conocido", async () => {
    const envio = await nuevoEnvio()
    await generarGuiaServientrega(admin, envio.id, datosGuia)
    api.consultarTrazabilidad.mockResolvedValueOnce(traz())
    await actualizarEstadoGuia(admin, envio.id)
    api.consultarTrazabilidad.mockResolvedValueOnce(traz({ estadoActual: null, movimientos: [], sinDatos: true }))
    const r = await actualizarEstadoGuia(admin, envio.id)
    expect(r.trazabilidad.sinDatos).toBe(true)
    expect(r.estado_actual).toBe("En Distribución a Cliente")
  })

  test("error del servicio → 424 con el mensaje; sin guía → 409; soporte → 403", async () => {
    const envio = await nuevoEnvio()
    await expect(actualizarEstadoGuia(admin, envio.id)).rejects.toMatchObject({ status: 409 })
    await generarGuiaServientrega(admin, envio.id, datosGuia)
    api.consultarTrazabilidad.mockRejectedValueOnce(new ServientregaError("rechazada", "Trazabilidad: Servicio caído"))
    await expect(actualizarEstadoGuia(admin, envio.id)).rejects.toMatchObject({
      status: 424,
      message: "Servientrega: Trazabilidad: Servicio caído",
    })
    await expect(actualizarEstadoGuia(soporte, envio.id)).rejects.toMatchObject({ status: 403 })
    expect((await envioEnBd(envio.id)).servientrega_consultado_at).toBeNull()
  })
})

describe("portal: guía para el rastreo público", () => {
  test("listarPedidosDeCliente trae la guía vigente; una anulada no", async () => {
    // Otro pedido antes, para que el id del envío no coincida con el del pedido.
    await crearPedido((await crearCliente()).id)
    await crearPedido((await crearCliente()).id)
    const envio = await nuevoEnvio()
    expect(envio.id).not.toBe(envio.pedido_id)
    const [pedido] = await db.select().from(pedidos).where(eq(pedidos.id, envio.pedido_id))
    expect((await listarPedidosDeCliente(pedido.cliente_id))[0].guia_servientrega).toBeNull()
    await generarGuiaServientrega(admin, envio.id, datosGuia)
    expect((await listarPedidosDeCliente(pedido.cliente_id))[0].guia_servientrega).toBe("709533700")
    await anularGuiaServientrega(admin, envio.id)
    expect((await listarPedidosDeCliente(pedido.cliente_id))[0].guia_servientrega).toBeNull()
  })
})
