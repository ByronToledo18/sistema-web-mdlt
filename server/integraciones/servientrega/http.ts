import "server-only"

import https from "node:https"
import tls from "node:tls"
import { logger } from "@/lib/logger"
import type { ConfigServientrega } from "./config"
import { ServientregaError } from "./errores"

// Transporte HTTPS hacia Servientrega.
//
// - node:https y no fetch: QA se publica por IP con un certificado para
//   servientrega.com.ec, y fetch no permite fijar el SNI ni la validación del
//   nombre. Aquí se valida contra ese nombre; la verificación TLS NUNCA se
//   desactiva (rejectUnauthorized queda en su valor por defecto, true).
// - Las URLs llevan usuario y contraseña en la ruta: nunca se loguean ni
//   aparecen en los mensajes de error. Todo texto que sale hacia el log pasa
//   por redactar().
// - Timeout total por intento (20 s) y un reintento solo en GET (idempotente).
//   Un POST o DELETE fallido no se repite: podría generar o anular dos veces.

export const TIMEOUT_MS = 20_000
const MAX_BYTES = 15 * 1024 * 1024
const PAUSA_REINTENTO_MS = 500
const CONTEXTO = "integraciones/servientrega"

export type Metodo = "GET" | "POST" | "DELETE"

export interface Peticion {
  metodo: Metodo
  base: "api" | "documentos"
  // Ruta sin parámetros sensibles, p. ej. "/api/guiawebs/".
  ruta: string
  // Segmento ['a','b',…] que va al final de la ruta (se codifica aquí).
  parametros?: (string | number)[]
  cuerpo?: unknown
  // Nombre corto de la operación para los logs ("ciudades", "generar_guia").
  operacion: string
}

export interface Respuesta {
  status: number
  cuerpo: string
}

// ['a','b'] codificado para la ruta. Los números van sin comillas como en el
// ejemplo de GuiaDigital; el resto entre comillas simples.
export function segmentoParametros(valores: (string | number)[]): string {
  const lista = valores.map((v) => (typeof v === "number" ? String(v) : `'${v}'`)).join(",")
  return encodeURIComponent(`[${lista}]`)
}

// Reemplaza usuario y contraseña (tal cual y codificados) por [REDACTADO].
export function redactar(texto: string, config: Pick<ConfigServientrega, "usuario" | "password">): string {
  let salida = texto
  const secretos = [config.password, config.usuario]
    .filter((s) => s.length > 0)
    .flatMap((s) => [s, encodeURIComponent(s), encodeURIComponent(`'${s}'`)])
    .sort((a, b) => b.length - a.length)
  for (const secreto of secretos) salida = salida.split(secreto).join("[REDACTADO]")
  return salida
}

// Opciones TLS del ambiente. Exportado para los tests.
export function opcionesTls(config: ConfigServientrega): Pick<https.RequestOptions, "servername" | "checkServerIdentity"> {
  const servername = config.endpoints.tlsServername
  if (!servername) return {}
  return {
    servername,
    checkServerIdentity: (_host, cert) => tls.checkServerIdentity(servername, cert),
  }
}

function construirUrl(config: ConfigServientrega, peticion: Peticion): URL {
  const base = peticion.base === "api" ? config.endpoints.api : config.endpoints.documentos
  const sufijo = peticion.parametros ? segmentoParametros(peticion.parametros) : ""
  return new URL(`${base}${peticion.ruta}${sufijo}`)
}

function unIntento(config: ConfigServientrega, peticion: Peticion): Promise<Respuesta> {
  const url = construirUrl(config, peticion)
  const cuerpo = peticion.cuerpo === undefined ? undefined : JSON.stringify(peticion.cuerpo)

  return new Promise<Respuesta>((resolve, reject) => {
    let terminado = false
    const fallar = (error: ServientregaError) => {
      if (terminado) return
      terminado = true
      clearTimeout(timer)
      reject(error)
    }

    const req = https.request(
      url,
      {
        method: peticion.metodo,
        headers: {
          Accept: "application/json",
          ...(cuerpo !== undefined
            ? { "Content-Type": "application/json; charset=utf-8", "Content-Length": Buffer.byteLength(cuerpo) }
            : {}),
        },
        ...opcionesTls(config),
      },
      (res) => {
        // setEncoding decodifica UTF-8 sin partir caracteres entre chunks.
        res.setEncoding("utf8")
        const partes: string[] = []
        let bytes = 0
        res.on("data", (chunk: string) => {
          bytes += chunk.length
          if (bytes > MAX_BYTES) {
            req.destroy()
            fallar(new ServientregaError("respuesta_invalida", "La respuesta de Servientrega es demasiado grande"))
            return
          }
          partes.push(chunk)
        })
        res.on("end", () => {
          if (terminado) return
          terminado = true
          clearTimeout(timer)
          resolve({ status: res.statusCode ?? 0, cuerpo: partes.join("") })
        })
        res.on("error", (error) => fallar(errorDeRed(error, config)))
      },
    )

    // Límite total del intento (conexión + respuesta), no solo de inactividad.
    const timer = setTimeout(() => {
      fallar(new ServientregaError("timeout", "Servientrega no respondió a tiempo"))
      req.destroy()
    }, TIMEOUT_MS)

    req.on("error", (error) => fallar(errorDeRed(error, config)))
    if (cuerpo !== undefined) req.write(cuerpo)
    req.end()
  })
}

function errorDeRed(error: unknown, config: ConfigServientrega): ServientregaError {
  const code = (error as { code?: unknown })?.code
  const detalle = typeof code === "string" ? code : error instanceof Error ? error.message : "error desconocido"
  return new ServientregaError("red", `No se pudo conectar con Servientrega (${redactar(detalle, config)})`)
}

function reintentable(error: unknown): boolean {
  return error instanceof ServientregaError && (error.tipo === "red" || error.tipo === "timeout")
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Envía la petición. Un 5xx en GET también se reintenta; el status de la
// última respuesta se devuelve tal cual para que el llamador lo interprete.
export async function enviar(config: ConfigServientrega, peticion: Peticion): Promise<Respuesta> {
  const intentos = peticion.metodo === "GET" ? 2 : 1
  for (let intento = 1; ; intento++) {
    try {
      const respuesta = await unIntento(config, peticion)
      if (respuesta.status >= 500 && intento < intentos) {
        logger.warn(CONTEXTO, `${peticion.operacion}: HTTP ${respuesta.status}, reintentando`, { intento })
        await pausa(PAUSA_REINTENTO_MS)
        continue
      }
      return respuesta
    } catch (error) {
      const mensaje = error instanceof Error ? redactar(error.message, config) : "error desconocido"
      if (reintentable(error) && intento < intentos) {
        logger.warn(CONTEXTO, `${peticion.operacion}: ${mensaje}, reintentando`, { intento })
        await pausa(PAUSA_REINTENTO_MS)
        continue
      }
      logger.warn(CONTEXTO, `${peticion.operacion}: ${mensaje}`, { intento })
      throw error
    }
  }
}
