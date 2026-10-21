import type { EventEmitter } from "node:events"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { anulacionExitosa, crearClienteServientrega, limpiarCacheCiudades } from "@/server/integraciones/servientrega/cliente"
import { leerConfig } from "@/server/integraciones/servientrega/config"
import { ServientregaError } from "@/server/integraciones/servientrega/errores"
import { opcionesTls, redactar, segmentoParametros, TIMEOUT_MS } from "@/server/integraciones/servientrega/http"

// Ningún test llama a la API real: node:https queda reemplazado por un doble
// que registra cada petición y responde según `responder`.
type Responder = (peticion: PeticionCapturada) => void
interface PeticionCapturada {
  url: URL
  opciones: Record<string, unknown> & { method?: string; servername?: string; checkServerIdentity?: unknown }
  cuerpo: string
  responder: (status: number, cuerpo: string) => void
  fallar: (error: Error & { code?: string }) => void
}

// vi.mock se eleva sobre los imports: el estado compartido va en vi.hoisted.
const estado = vi.hoisted(() => ({
  capturadas: [] as PeticionCapturada[],
  responder: (() => {}) as Responder,
}))
const capturadas = estado.capturadas

vi.mock("node:https", async () => {
  const { EventEmitter } = await import("node:events")
  const request = (url: URL, opciones: Record<string, unknown>, onResponse: (res: EventEmitter) => void) => {
    const req = new EventEmitter() as EventEmitter & {
      write: (s: string) => void
      end: () => void
      destroy: () => void
    }
    let cuerpo = ""
    req.write = (s: string) => {
      cuerpo += s
    }
    req.destroy = () => {}
    req.end = () => {
      const peticion: PeticionCapturada = {
        url,
        opciones,
        cuerpo,
        responder: (status, texto) => {
          const res = new EventEmitter() as EventEmitter & { statusCode: number; setEncoding: (e: string) => void }
          res.statusCode = status
          res.setEncoding = () => {}
          onResponse(res)
          res.emit("data", texto)
          res.emit("end")
        },
        fallar: (error) => req.emit("error", error),
      }
      estado.capturadas.push(peticion)
      queueMicrotask(() => estado.responder(peticion))
    }
    return req
  }
  return { default: { request }, request }
})


// Contraseña con caracteres que cambian al codificarse en la URL.
const PASSWORD = "Cl@ve/ñ 9"
const USUARIO = "usr.test"
const configQa = leerConfig({ SERVIENTREGA_AMBIENTE: "qa", SERVIENTREGA_USUARIO: USUARIO, SERVIENTREGA_PASSWORD: PASSWORD })
const configProd = leerConfig({ SERVIENTREGA_AMBIENTE: "prod", SERVIENTREGA_USUARIO: USUARIO, SERVIENTREGA_PASSWORD: PASSWORD })

const PDF_B64 = Buffer.from("%PDF-1.7\n%prueba\n%%EOF").toString("base64")

const guiaInput = {
  ciudad_origen_id: 1,
  ciudad_destino_id: 2,
  remitente: { identificacion: "1", razon_social: "R", nombre: "N", apellido: "A", direccion: "D", telefono: "T" },
  destinatario: { identificacion: "2", razon_social: "R", nombre: "N", apellido: "A", direccion: "D", telefono: "T" },
  producto_id: 2,
  contenido: "Tutú",
  piezas: 1,
  peso_kg: 0.5,
  valor_mercancia: 10,
}

let logs: string[] = []

async function capturar(promesa: Promise<unknown>): Promise<ServientregaError> {
  try {
    await promesa
  } catch (error) {
    return error as ServientregaError
  }
  throw new Error("se esperaba un error")
}

beforeEach(() => {
  capturadas.length = 0
  estado.responder = (p) => p.responder(200, "[]")
  limpiarCacheCiudades()
  logs = []
  const guardar = (...args: unknown[]) => {
    logs.push(args.map((a) => (a instanceof Error ? a.message : JSON.stringify(a))).join(" "))
  }
  vi.spyOn(console, "warn").mockImplementation(guardar)
  vi.spyOn(console, "error").mockImplementation(guardar)
  vi.spyOn(console, "info").mockImplementation(guardar)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function sinSecretos(texto: string) {
  expect(texto).not.toContain(PASSWORD)
  expect(texto).not.toContain(encodeURIComponent(PASSWORD))
  expect(texto).not.toContain(USUARIO)
}

describe("TLS", () => {
  test("QA: SNI y validación del certificado contra servientrega.com.ec, sin desactivar la verificación", async () => {
    estado.responder = (p) => p.responder(200, JSON.stringify([{ id: 2, nombre: "QUITO (PICHINCHA)" }]))
    await crearClienteServientrega(configQa).listarCiudades()
    const { opciones, url } = capturadas[0]
    expect(url.hostname).toBe("181.39.87.158")
    expect(opciones.servername).toBe("servientrega.com.ec")
    expect(opciones).not.toHaveProperty("rejectUnauthorized")

    const check = opciones.checkServerIdentity as (host: string, cert: unknown) => Error | undefined
    const cert = (san: string) => ({ subject: { CN: "servientrega.com.ec" }, subjectaltname: san })
    expect(check("181.39.87.158", cert("DNS:servientrega.com.ec, DNS:*.servientrega.com.ec"))).toBeUndefined()
    expect(check("181.39.87.158", cert("DNS:otro-dominio.com"))).toBeInstanceOf(Error)
  })

  test("prod: el host ya coincide con el certificado, validación por defecto", () => {
    expect(opcionesTls(configProd)).toEqual({})
  })
})

describe("parámetros en la ruta", () => {
  test("['usuario','contraseña'] va URL-encoded", async () => {
    estado.responder = (p) => p.responder(200, JSON.stringify([{ id: 1, nombre: "GUAYAQUIL (GUAYAS)" }]))
    await crearClienteServientrega(configQa).listarCiudades()
    const { url } = capturadas[0]
    expect(url.pathname).toBe(`/api/ciudades/${encodeURIComponent(`['${USUARIO}','${PASSWORD}']`)}`)
    expect(url.port).toBe("8021")
    expect(segmentoParametros(["123", "u", "p", "1"])).toBe(encodeURIComponent("['123','u','p','1']"))
  })

  test("guía A4 al puerto de documentos con el estado 1; rótulo con tres parámetros", async () => {
    estado.responder = (p) => p.responder(201, JSON.stringify({ guia: 1, mensaje: "", archivoEncriptado: PDF_B64 }))
    const cliente = crearClienteServientrega(configProd)
    await cliente.obtenerPdfGuia("709533698")
    await cliente.obtenerRotulo("709533698")
    expect(capturadas[0].url.origin).toBe("https://swservicli.servientrega.com.ec:5001")
    expect(decodeURIComponent(capturadas[0].url.pathname)).toBe(`/api/GuiasWeb/['709533698','${USUARIO}','${PASSWORD}','1']`)
    expect(decodeURIComponent(capturadas[1].url.pathname)).toBe(`/api/ImprimeRotulos/['709533698','${USUARIO}','${PASSWORD}']`)
  })
})

describe("listarCiudades", () => {
  test("parsea, ordena y cachea 24 h (una sola petición)", async () => {
    estado.responder = (p) =>
      p.responder(200, JSON.stringify([{ id: 2, nombre: "QUITO (PICHINCHA)" }, { id: 4, nombre: "CUENCA (AZUAY)" }]))
    const cliente = crearClienteServientrega(configQa)
    expect(await cliente.listarCiudades()).toEqual([
      { id: 4, nombre: "CUENCA (AZUAY)" },
      { id: 2, nombre: "QUITO (PICHINCHA)" },
    ])
    await cliente.listarCiudades()
    await crearClienteServientrega(configQa).listarCiudades()
    expect(capturadas).toHaveLength(1)
  })

  test("los errores no se cachean", async () => {
    estado.responder = (p) => p.responder(200, "no es json")
    const cliente = crearClienteServientrega(configQa)
    await expect(cliente.listarCiudades()).rejects.toMatchObject({ tipo: "respuesta_invalida" })
    estado.responder = (p) => p.responder(200, JSON.stringify([{ id: 2, nombre: "QUITO (PICHINCHA)" }]))
    await expect(cliente.listarCiudades()).resolves.toHaveLength(1)
  })
})

describe("generarGuia", () => {
  test("POST con el JSON mapeado y devuelve el número de guía", async () => {
    estado.responder = (p) => p.responder(201, JSON.stringify({ id: 709533697, msj: "GUÍA REGISTRADA CORRECTAMENTE" }))
    const r = await crearClienteServientrega(configQa).generarGuia(guiaInput)
    expect(r).toEqual({ numero: "709533697", mensaje: "GUÍA REGISTRADA CORRECTAMENTE" })
    const { opciones, url, cuerpo } = capturadas[0]
    expect(opciones.method).toBe("POST")
    expect(url.pathname).toBe("/api/guiawebs/")
    expect(JSON.parse(cuerpo)).toMatchObject({ id_ciudad_destino: 2, login_creacion: USUARIO, password: PASSWORD })
  })

  test("500 sin cuerpo (así rechaza QA los datos inválidos) → rechazada", async () => {
    estado.responder = (p) => p.responder(500, "")
    await expect(crearClienteServientrega(configQa).generarGuia(guiaInput)).rejects.toMatchObject({
      tipo: "rechazada",
      status: 500,
    })
    expect(capturadas).toHaveLength(1)
  })

  test("sin id → rechazada con el mensaje de Servientrega, redactado", async () => {
    estado.responder = (p) => p.responder(201, JSON.stringify({ id: 0, msj: `USUARIO ${USUARIO} SIN PERMISO` }))
    const error = await capturar(crearClienteServientrega(configQa).generarGuia(guiaInput))
    expect(error).toMatchObject({ tipo: "rechazada" })
    expect(error.message).toContain("SIN PERMISO")
    sinSecretos(error.message)
  })

  test("otros status de error → http, con el cuerpo redactado", async () => {
    estado.responder = (p) => p.responder(400, `credenciales ${PASSWORD} inválidas`)
    const error = await capturar(crearClienteServientrega(configQa).generarGuia(guiaInput))
    expect(error).toMatchObject({ tipo: "http", status: 400 })
    sinSecretos(error.message)
  })
})

describe("anularGuia", () => {
  test("DELETE; el resultado se lee del mensaje", async () => {
    estado.responder = (p) => p.responder(201, JSON.stringify({ id: 709533698, msj: "GUÍA ANULADA CORRECTAMENTE" }))
    await expect(crearClienteServientrega(configQa).anularGuia("709533698")).resolves.toEqual({
      mensaje: "GUÍA ANULADA CORRECTAMENTE",
    })
    expect(capturadas[0].opciones.method).toBe("DELETE")
    expect(decodeURIComponent(capturadas[0].url.pathname)).toBe(`/api/guiawebs/['709533698','${USUARIO}','${PASSWORD}']`)
  })

  test("201 con un rechazo en el mensaje → rechazada", async () => {
    const msj = "LA GUÍA NO PUEDE SER ANULADA, PORQUE ESTA SIENDO PROCESADA"
    estado.responder = (p) => p.responder(201, JSON.stringify({ id: 709533698, msj }))
    await expect(crearClienteServientrega(configQa).anularGuia("709533698")).rejects.toMatchObject({
      tipo: "rechazada",
      message: msj,
    })
    expect(anulacionExitosa("Guía anulada")).toBe(true)
    expect(anulacionExitosa("NO SE PUDO ANULAR")).toBe(false)
  })
})

describe("PDF (guía A4 y rótulo)", () => {
  test("decodifica archivoEncriptado a un Buffer que empieza con %PDF", async () => {
    estado.responder = (p) =>
      p.responder(201, JSON.stringify({ guia: 709533698, mensaje: "LA GUÍA FUE GENERADA CORRECTAMENTE", archivoEncriptado: PDF_B64 }))
    const pdf = await crearClienteServientrega(configQa).obtenerPdfGuia("709533698")
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })

  test("acepta un string base64 entre comillas", async () => {
    estado.responder = (p) => p.responder(200, JSON.stringify(PDF_B64))
    const pdf = await crearClienteServientrega(configQa).obtenerRotulo("1")
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-")
  })

  test("sin archivo → rechazada con el mensaje (rótulo ya impreso)", async () => {
    const mensaje = "LA GUÍA #709533698 YA SE ENCUENTRA IMPRESA POR RÓTULO"
    estado.responder = (p) => p.responder(201, JSON.stringify({ guia: 0, mensaje }))
    await expect(crearClienteServientrega(configQa).obtenerRotulo("709533698")).rejects.toMatchObject({
      tipo: "rechazada",
      message: mensaje,
    })
  })

  test("un archivo que no es PDF → respuesta_invalida", async () => {
    estado.responder = (p) =>
      p.responder(201, JSON.stringify({ guia: 1, archivoEncriptado: Buffer.from("<html>").toString("base64") }))
    await expect(crearClienteServientrega(configQa).obtenerPdfGuia("1")).rejects.toMatchObject({
      tipo: "respuesta_invalida",
    })
  })
})

describe("errores de red, timeout y reintentos", () => {
  test("GET: un error de red se reintenta una vez", async () => {
    let n = 0
    estado.responder = (p) => {
      n++
      if (n === 1) p.fallar(Object.assign(new Error("connect ECONNRESET"), { code: "ECONNRESET" }))
      else p.responder(200, JSON.stringify([{ id: 2, nombre: "QUITO (PICHINCHA)" }]))
    }
    await expect(crearClienteServientrega(configQa).listarCiudades()).resolves.toHaveLength(1)
    expect(capturadas).toHaveLength(2)
  })

  test("GET: un 5xx se reintenta una vez y luego falla como http", async () => {
    estado.responder = (p) => p.responder(503, "")
    await expect(crearClienteServientrega(configQa).listarCiudades()).rejects.toMatchObject({ tipo: "http", status: 503 })
    expect(capturadas).toHaveLength(2)
  })

  test("POST y DELETE no se reintentan", async () => {
    estado.responder = (p) => p.fallar(Object.assign(new Error("x"), { code: "ECONNREFUSED" }))
    const cliente = crearClienteServientrega(configQa)
    await expect(cliente.generarGuia(guiaInput)).rejects.toMatchObject({ tipo: "red" })
    await expect(cliente.anularGuia("1")).rejects.toMatchObject({ tipo: "red" })
    expect(capturadas).toHaveLength(2)
  })

  test("timeout a los 20 s (GET: dos intentos)", async () => {
    vi.useFakeTimers()
    estado.responder = () => {} // nunca responde
    const promesa = crearClienteServientrega(configQa).obtenerPdfGuia("1")
    const resultado = promesa.catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS * 2 + 1_000)
    expect(await resultado).toMatchObject({ tipo: "timeout" })
    expect(capturadas).toHaveLength(2)
  })

  test("timeout en POST: un solo intento", async () => {
    vi.useFakeTimers()
    estado.responder = () => {}
    const resultado = crearClienteServientrega(configQa)
      .generarGuia(guiaInput)
      .catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 1)
    expect(await resultado).toMatchObject({ tipo: "timeout" })
    expect(capturadas).toHaveLength(1)
  })
})

describe("redacción en logs", () => {
  test("ningún log ni mensaje de error contiene usuario, contraseña ni la URL", async () => {
    estado.responder = (p) =>
      p.fallar(Object.assign(new Error(`connect failed ${p.url.toString()}`), { code: undefined as unknown as string }))
    const error = await capturar(crearClienteServientrega(configQa).listarCiudades())
    expect(error).toBeInstanceOf(ServientregaError)
    sinSecretos(error.message)
    expect(logs.length).toBeGreaterThan(0)
    for (const linea of logs) sinSecretos(linea)
  })

  test("redactar reemplaza los valores tal cual y codificados", () => {
    const texto = `u=${USUARIO} p=${PASSWORD} enc=${encodeURIComponent(`'${PASSWORD}'`)} raw=${encodeURIComponent(PASSWORD)}`
    const r = redactar(texto, configQa)
    sinSecretos(r)
    expect(r).toContain("[REDACTADO]")
  })
})
