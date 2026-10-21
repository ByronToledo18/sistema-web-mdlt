import "server-only"

import { z } from "zod"
import { normalizarTexto, type CiudadServientrega } from "@/lib/servientrega"
import { leerConfig, type ConfigServientrega } from "./config"
import { ServientregaError } from "./errores"
import { mapearGuia, type GuiaInput } from "./guia"
import { enviar, redactar, type Peticion, type Respuesta } from "./http"
import { consultarTrazabilidad, type TrazabilidadGuia } from "./trazabilidad"

// Cliente de la API de Servientrega (Servicli). Formatos reales observados en
// QA (ver docs/servientrega-api.md):
//
// - GET ciudades → 200 [{ id, nombre: "QUITO (PICHINCHA)" }, …]
// - POST guiawebs → 201 { id: 709533698, msj: "GUÍA REGISTRADA CORRECTAMENTE" }.
//   Con datos inválidos responde 500 sin cuerpo.
// - DELETE guiawebs → 201 { id, msj } tanto si anula como si no; el resultado
//   va en msj ("LA GUÍA NO PUEDE SER ANULADA, PORQUE ESTA SIENDO PROCESADA").
// - GET GuiasWeb / ImprimeRotulos → 201 { guia, mensaje, archivoEncriptado }
//   con el PDF en base64 en archivoEncriptado (vacío si no lo entrega). El
//   rótulo se entrega UNA sola vez; la guía A4 se puede volver a pedir.

const CACHE_CIUDADES_MS = 24 * 60 * 60 * 1000

const ciudadesSchema = z.array(z.object({ id: z.coerce.number().int(), nombre: z.string() }))
const respuestaGuiaSchema = z.object({ id: z.coerce.number().optional(), msj: z.string().optional() })
const respuestaDocumentoSchema = z.object({
  guia: z.unknown().optional(),
  mensaje: z.string().nullish(),
  archivoEncriptado: z.string().nullish(),
})

// Cache en memoria por instancia (y por ambiente). Con Next 16 sin
// cacheComponents, "use cache" no está disponible y unstable_cache no aporta
// nada para 600 filas que cambian casi nunca; cada instancia de la función
// las pide como mucho una vez al día. Vive en globalThis por la misma razón
// que el sink de lib/logger.ts (copias del módulo por capa de webpack).
const CACHE_KEY = "__mdltServientregaCiudades"
type CacheCiudades = Map<string, { expira: number; ciudades?: CiudadServientrega[]; enCurso?: Promise<CiudadServientrega[]> }>
const store = globalThis as typeof globalThis & { [CACHE_KEY]?: CacheCiudades }
function cacheCiudades(): CacheCiudades {
  store[CACHE_KEY] ??= new Map()
  return store[CACHE_KEY]
}

// Solo para tests.
export function limpiarCacheCiudades() {
  store[CACHE_KEY]?.clear()
}

function parsearJson(respuesta: Respuesta, operacion: string): unknown {
  try {
    return JSON.parse(respuesta.cuerpo)
  } catch {
    throw new ServientregaError("respuesta_invalida", `Servientrega devolvió una respuesta inesperada (${operacion})`)
  }
}

function exigirOk(respuesta: Respuesta, operacion: string, config: ConfigServientrega) {
  if (respuesta.status >= 200 && respuesta.status < 300) return
  // El cuerpo de error puede repetir lo enviado: se redacta y se recorta.
  const detalle = redactar(respuesta.cuerpo, config).trim().slice(0, 200)
  throw new ServientregaError(
    "http",
    `Servientrega respondió con un error en ${operacion} (HTTP ${respuesta.status})${detalle ? `: ${detalle}` : ""}`,
    respuesta.status,
  )
}

async function pedir(config: ConfigServientrega, peticion: Peticion) {
  const respuesta = await enviar(config, peticion)
  exigirOk(respuesta, peticion.operacion, config)
  return parsearJson(respuesta, peticion.operacion)
}

export interface GuiaGenerada {
  numero: string
  mensaje: string
}

export interface ClienteServientrega {
  ambiente: ConfigServientrega["ambiente"]
  listarCiudades(): Promise<CiudadServientrega[]>
  generarGuia(input: GuiaInput): Promise<GuiaGenerada>
  anularGuia(numero: string): Promise<{ mensaje: string }>
  obtenerPdfGuia(numero: string): Promise<Buffer>
  obtenerRotulo(numero: string): Promise<Buffer>
  // Servicio SOAP aparte (ver trazabilidad.ts).
  consultarTrazabilidad(numero: string): Promise<TrazabilidadGuia>
}

// Base64 → PDF. Acepta también un string JSON entre comillas por si el
// endpoint lo devuelve así (la documentación lo sugiere).
export function decodificarPdf(cuerpo: unknown, operacion: string): Buffer {
  let base64: string | null | undefined
  let mensaje = ""
  if (typeof cuerpo === "string") {
    base64 = cuerpo
  } else {
    const parsed = respuestaDocumentoSchema.safeParse(cuerpo)
    if (!parsed.success) {
      throw new ServientregaError("respuesta_invalida", `Servientrega devolvió una respuesta inesperada (${operacion})`)
    }
    base64 = parsed.data.archivoEncriptado
    mensaje = parsed.data.mensaje?.trim() ?? ""
  }
  if (!base64 || !base64.trim()) {
    throw new ServientregaError("rechazada", mensaje || `Servientrega no devolvió el archivo (${operacion})`)
  }
  const pdf = Buffer.from(base64.trim(), "base64")
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new ServientregaError("respuesta_invalida", `Servientrega devolvió un archivo que no es PDF (${operacion})`)
  }
  return pdf
}

// La anulación responde 201 { id, msj } aunque la rechace: el resultado se
// lee del mensaje.
export function anulacionExitosa(mensaje: string): boolean {
  const m = normalizarTexto(mensaje)
  if (!m.includes("ANULAD")) return false
  return !/\bNO\b/.test(m) && !m.includes("ERROR")
}

export function crearClienteServientrega(config: ConfigServientrega = leerConfig()): ClienteServientrega {
  const credenciales = [config.usuario, config.password]

  return {
    ambiente: config.ambiente,

    async listarCiudades() {
      const cache = cacheCiudades()
      const entrada = cache.get(config.ambiente)
      if (entrada?.ciudades && entrada.expira > Date.now()) return entrada.ciudades
      if (entrada?.enCurso) return entrada.enCurso

      const enCurso = (async () => {
        const datos = await pedir(config, {
          metodo: "GET",
          base: "api",
          ruta: "/api/ciudades/",
          parametros: credenciales,
          operacion: "ciudades",
        })
        const parsed = ciudadesSchema.safeParse(datos)
        if (!parsed.success || parsed.data.length === 0) {
          throw new ServientregaError("respuesta_invalida", "Servientrega devolvió una lista de ciudades inesperada")
        }
        return [...parsed.data].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      })()
      cache.set(config.ambiente, { expira: 0, enCurso })
      try {
        const ciudades = await enCurso
        cache.set(config.ambiente, { expira: Date.now() + CACHE_CIUDADES_MS, ciudades })
        return ciudades
      } catch (error) {
        // Los errores no se cachean.
        cache.delete(config.ambiente)
        throw error
      }
    },

    async generarGuia(input) {
      const respuesta = await enviar(config, {
        metodo: "POST",
        base: "api",
        ruta: "/api/guiawebs/",
        cuerpo: mapearGuia(input, config),
        operacion: "generar_guia",
      })
      if (respuesta.status === 500 && !respuesta.cuerpo.trim()) {
        // Así responde QA cuando falta o sobra un campo, o un id no existe.
        throw new ServientregaError(
          "rechazada",
          "Servientrega rechazó los datos de la guía. Revisa la ciudad de destino, el teléfono y la dirección.",
          500,
        )
      }
      exigirOk(respuesta, "generar_guia", config)
      const parsed = respuestaGuiaSchema.safeParse(parsearJson(respuesta, "generar_guia"))
      if (!parsed.success) {
        throw new ServientregaError("respuesta_invalida", "Servientrega devolvió una respuesta inesperada al generar la guía")
      }
      const { id, msj = "" } = parsed.data
      if (!id || !Number.isFinite(id) || id <= 0) {
        throw new ServientregaError("rechazada", redactar(msj.trim(), config) || "Servientrega no generó la guía")
      }
      return { numero: String(id), mensaje: msj }
    },

    async anularGuia(numero) {
      const datos = await pedir(config, {
        metodo: "DELETE",
        base: "api",
        ruta: "/api/guiawebs/",
        parametros: [numero, ...credenciales],
        operacion: "anular_guia",
      })
      const parsed = respuestaGuiaSchema.safeParse(datos)
      if (!parsed.success) {
        throw new ServientregaError("respuesta_invalida", "Servientrega devolvió una respuesta inesperada al anular")
      }
      const mensaje = redactar(parsed.data.msj?.trim() ?? "", config)
      if (!anulacionExitosa(mensaje)) {
        throw new ServientregaError("rechazada", mensaje || "Servientrega no anuló la guía")
      }
      return { mensaje }
    },

    async obtenerPdfGuia(numero) {
      const datos = await pedir(config, {
        metodo: "GET",
        base: "documentos",
        ruta: "/api/GuiasWeb/",
        // El último parámetro es el estado de la guía que pide la API (1).
        parametros: [numero, ...credenciales, "1"],
        operacion: "pdf_guia",
      })
      return decodificarPdf(datos, "pdf_guia")
    },

    async obtenerRotulo(numero) {
      const datos = await pedir(config, {
        metodo: "GET",
        base: "documentos",
        ruta: "/api/ImprimeRotulos/",
        parametros: [numero, ...credenciales],
        operacion: "rotulo",
      })
      return decodificarPdf(datos, "rotulo")
    },

    consultarTrazabilidad(numero) {
      return consultarTrazabilidad(config, numero)
    },
  }
}
