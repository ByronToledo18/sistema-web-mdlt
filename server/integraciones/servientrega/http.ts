import "server-only"

import https from "node:https"
import tls from "node:tls"
import { HttpsProxyAgent } from "https-proxy-agent"
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
// - Con SERVIENTREGA_PROXY_URL todo sale por ese proxy (HTTP CONNECT, con
//   https-proxy-agent). El túnel es TCP: el TLS sigue siendo de punta a punta
//   con Servientrega y se valida igual (mismo servername/checkServerIdentity).
//   La URL del proxy lleva credenciales: tampoco se loguea.

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

// Petición HTTPS genérica: la usan la API JSON de Servicli (enviar) y el
// servicio SOAP de trazabilidad (trazabilidad.ts).
export interface SolicitudHttps {
  url: URL
  metodo: Metodo
  headers: Record<string, string | number>
  cuerpo?: string
  tls: Pick<https.RequestOptions, "servername" | "checkServerIdentity">
  // Nombre corto de la operación para los logs.
  operacion: string
  // Solo operaciones de lectura (GET o consultas SOAP).
  reintentable: boolean
  // Quita secretos de cualquier texto que vaya al log o a un error.
  redactar: (texto: string) => string
  // Proxy de salida (null = conexión directa).
  proxy: string | null
}

export interface RespuestaCruda {
  status: number
  contentType: string
  // Bytes tal cual: cada llamador decodifica según su charset.
  cuerpo: Buffer
}

// Un agente por URL de proxy (reutiliza la configuración entre peticiones).
const AGENTES_KEY = "__mdltServientregaProxyAgents"
const agentes = globalThis as typeof globalThis & { [AGENTES_KEY]?: Map<string, https.Agent> }
export function agenteProxy(proxy: string): https.Agent {
  agentes[AGENTES_KEY] ??= new Map()
  let agente = agentes[AGENTES_KEY].get(proxy)
  if (!agente) {
    agente = new HttpsProxyAgent(proxy) as unknown as https.Agent
    agentes[AGENTES_KEY].set(proxy, agente)
  }
  return agente
}

// Usuario y contraseña del proxy, tal cual y codificados en la URL.
export function redactarProxy(texto: string, proxy: string | null): string {
  if (!proxy) return texto
  let salida = texto.split(proxy).join("[PROXY]")
  try {
    const u = new URL(proxy)
    for (const secreto of [u.password, u.username, decodeURIComponent(u.password), decodeURIComponent(u.username)]) {
      if (secreto) salida = salida.split(secreto).join("[REDACTADO]")
    }
  } catch {
    // La config ya validó la URL.
  }
  return salida
}

function unIntento(s: SolicitudHttps): Promise<RespuestaCruda> {
  return new Promise<RespuestaCruda>((resolve, reject) => {
    let terminado = false
    const fallar = (error: ServientregaError) => {
      if (terminado) return
      terminado = true
      clearTimeout(timer)
      reject(error)
    }

    const req = https.request(
      s.url,
      {
        method: s.metodo,
        headers: {
          ...s.headers,
          ...(s.cuerpo !== undefined ? { "Content-Length": Buffer.byteLength(s.cuerpo) } : {}),
        },
        // Sin proxy, el agente global (conexión directa).
        ...(s.proxy ? { agent: agenteProxy(s.proxy) } : {}),
        ...s.tls,
      },
      (res) => {
        // latin1 conserva cada byte como un carácter: se rearma el Buffer al final.
        res.setEncoding("latin1")
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
          resolve({
            status: res.statusCode ?? 0,
            contentType: String(res.headers?.["content-type"] ?? ""),
            cuerpo: Buffer.from(partes.join(""), "latin1"),
          })
        })
        res.on("error", (error) => fallar(errorDeRed(error, s.redactar)))
      },
    )

    // Límite total del intento (conexión + respuesta), no solo de inactividad.
    const timer = setTimeout(() => {
      fallar(new ServientregaError("timeout", "Servientrega no respondió a tiempo"))
      req.destroy()
    }, TIMEOUT_MS)

    req.on("error", (error) => fallar(errorDeRed(error, s.redactar)))
    if (s.cuerpo !== undefined) req.write(s.cuerpo)
    req.end()
  })
}

function errorDeRed(error: unknown, redactarTexto: (t: string) => string): ServientregaError {
  const code = (error as { code?: unknown })?.code
  const detalle = typeof code === "string" ? code : error instanceof Error ? error.message : "error desconocido"
  return new ServientregaError("red", `No se pudo conectar con Servientrega (${redactarTexto(detalle)})`)
}

function reintentable(error: unknown): boolean {
  return error instanceof ServientregaError && (error.tipo === "red" || error.tipo === "timeout")
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Un intento más en las lecturas (también ante un 5xx); el status de la
// última respuesta se devuelve tal cual para que el llamador lo interprete.
export async function solicitarHttps(solicitud: SolicitudHttps): Promise<RespuestaCruda> {
  const s = { ...solicitud, redactar: (t: string) => redactarProxy(solicitud.redactar(t), solicitud.proxy) }
  const intentos = s.reintentable ? 2 : 1
  for (let intento = 1; ; intento++) {
    try {
      const respuesta = await unIntento(s)
      if (respuesta.status === 407 && s.proxy) {
        throw new ServientregaError(
          "red",
          "El proxy de salida rechazó la conexión (HTTP 407): revisa las credenciales de SERVIENTREGA_PROXY_URL",
          407,
        )
      }
      if (respuesta.status >= 500 && intento < intentos) {
        logger.warn(CONTEXTO, `${s.operacion}: HTTP ${respuesta.status}, reintentando`, { intento })
        await pausa(PAUSA_REINTENTO_MS)
        continue
      }
      return respuesta
    } catch (error) {
      const mensaje = error instanceof Error ? s.redactar(error.message) : "error desconocido"
      if (reintentable(error) && intento < intentos) {
        logger.warn(CONTEXTO, `${s.operacion}: ${mensaje}, reintentando`, { intento })
        await pausa(PAUSA_REINTENTO_MS)
        continue
      }
      logger.warn(CONTEXTO, `${s.operacion}: ${mensaje}`, { intento })
      throw error
    }
  }
}

// API JSON de Servicli. GET se reintenta una vez; POST y DELETE nunca.
export async function enviar(config: ConfigServientrega, peticion: Peticion): Promise<Respuesta> {
  const cuerpo = peticion.cuerpo === undefined ? undefined : JSON.stringify(peticion.cuerpo)
  const respuesta = await solicitarHttps({
    url: construirUrl(config, peticion),
    metodo: peticion.metodo,
    headers: {
      Accept: "application/json",
      ...(cuerpo !== undefined ? { "Content-Type": "application/json; charset=utf-8" } : {}),
    },
    cuerpo,
    tls: opcionesTls(config),
    operacion: peticion.operacion,
    reintentable: peticion.metodo === "GET",
    redactar: (texto) => redactar(texto, config),
    proxy: config.proxyUrl,
  })
  return { status: respuesta.status, cuerpo: respuesta.cuerpo.toString("utf8") }
}
