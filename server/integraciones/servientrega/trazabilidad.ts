import "server-only"

import type { ConfigServientrega } from "./config"
import { ServientregaError } from "./errores"
import { solicitarHttps } from "./http"

// Trazabilidad de guías: servicio SOAP ConsultarGuiaImagen (appsiscore.com).
// El sobre se arma a mano y la respuesta se lee con un parser mínimo, sin
// dependencias: el XML interno es plano y de etiquetas conocidas.
//
// Formato real (QA, 2026-10-20): 200 text/xml ISO-8859-1. El XML de la guía
// viene dentro de <Result> escapado con entidades (&lt;NumGui&gt;…); la
// documentación lo muestra como CDATA, así que se aceptan las dos formas.
// QA devuelve la estructura vacía (EstAct, FecEnv y Mov vacíos) para
// cualquier número, exista o no.

// Namespace del WSDL (es el mismo en pruebas y en producción).
const NAMESPACE = "https://servientrega-ecuador.appsiscore.com/app/ws/"

export interface MovimientoGuia {
  nombre: string
  origen: string
  descripcion: string
  fecha: string
}

export interface TrazabilidadGuia {
  numeroGuia: string
  // null cuando Servientrega no tiene datos de la guía.
  estadoActual: string | null
  idEstado: number | null
  fechaEstado: string | null
  fechaProbable: string | null
  fechaEnvio: string | null
  ciudadOrigen: string | null
  ciudadDestino: string | null
  receptor: string | null
  movimientos: MovimientoGuia[]
  // Mensaje sobre la prueba de entrega digitalizada (la imagen no se usa).
  mensajeImagen: string | null
  sinDatos: boolean
}

function escaparXml(texto: string): string {
  return texto.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!)
}

export function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase()
    if (k === "lt") return "<"
    if (k === "gt") return ">"
    if (k === "amp") return "&"
    if (k === "quot") return '"'
    if (k === "apos") return "'"
    const codigo = k.startsWith("#x") ? Number.parseInt(k.slice(2), 16) : Number.parseInt(k.slice(1), 10)
    return Number.isFinite(codigo) ? String.fromCodePoint(codigo) : ""
  })
}

export function sobreConsulta(numeroGuia: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ` +
    `xmlns:xsd="http://www.w3.org/2001/XMLSchema" ` +
    `xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="${NAMESPACE}">` +
    `<soapenv:Header/><soapenv:Body>` +
    `<ws:ConsultarGuiaImagen soapenv:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">` +
    `<guia xsi:type="xsd:string">${escaparXml(numeroGuia)}</guia>` +
    `</ws:ConsultarGuiaImagen></soapenv:Body></soapenv:Envelope>`
  )
}

// Contenido de la primera <etiqueta>…</etiqueta> (sin prefijo de namespace),
// "" si es <etiqueta/> y null si no está. Decodifica entidades y CDATA.
export function valorEtiqueta(xml: string, etiqueta: string): string | null {
  const re = new RegExp(`<(?:[\\w-]+:)?${etiqueta}(?:\\s[^>]*)?(?:/>|>([\\s\\S]*?)</(?:[\\w-]+:)?${etiqueta}\\s*>)`, "i")
  const m = re.exec(xml)
  if (!m) return null
  const interior = m[1] ?? ""
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(interior)
  return cdata ? cdata[1] : decodificarEntidades(interior)
}

function bloques(xml: string, etiqueta: string): string[] {
  const re = new RegExp(`<${etiqueta}(?:\\s[^>]*)?>([\\s\\S]*?)</${etiqueta}\\s*>`, "gi")
  return [...xml.matchAll(re)].map((m) => m[1])
}

const limpio = (v: string | null) => {
  const t = v?.replace(/\s+/g, " ").trim()
  return t ? t : null
}

// Respuesta SOAP completa → trazabilidad. Exportado para los tests.
export function parsearTrazabilidad(soap: string, numeroGuia: string): TrazabilidadGuia {
  const fault = valorEtiqueta(soap, "faultstring")
  if (fault !== null) {
    throw new ServientregaError("rechazada", `Trazabilidad: ${limpio(fault) ?? "error SOAP"}`)
  }
  const result = valorEtiqueta(soap, "Result")
  if (result === null) {
    throw new ServientregaError("respuesta_invalida", "Servientrega devolvió una trazabilidad inesperada")
  }
  const guia = valorEtiqueta(result, "ConsultarGuiaImagenResult")
  if (guia === null) {
    // Sin el XML de la guía: lo que venga es un mensaje del servicio.
    const mensaje = limpio(result.replace(/<[^>]+>/g, " "))
    if (!mensaje) return vacia(numeroGuia)
    throw new ServientregaError("rechazada", `Trazabilidad: ${mensaje.slice(0, 200)}`)
  }

  const campo = (etiqueta: string) => limpio(valorEtiqueta(guia, etiqueta))
  const movimientos = bloques(guia, "InformacionMov")
    .map((mov) => ({
      nombre: limpio(valorEtiqueta(mov, "NomMov")) ?? "",
      origen: limpio(valorEtiqueta(mov, "OriMov")) ?? "",
      descripcion: limpio(valorEtiqueta(mov, "DesMov")) ?? "",
      fecha: limpio(valorEtiqueta(mov, "FecMov")) ?? "",
    }))
    .filter((m) => m.nombre || m.descripcion || m.fecha)

  const estadoActual = campo("EstAct")
  const fechaEnvio = campo("FecEnv")
  // QA responde IdEstAct=3 aun para guías inexistentes: sin estado, fecha de
  // envío ni movimientos, no hay datos.
  const sinDatos = !estadoActual && !fechaEnvio && movimientos.length === 0
  if (sinDatos) return { ...vacia(campo("NumGui") ?? numeroGuia), mensajeImagen: campo("MensajeBuscarImagen") }

  const id = Number.parseInt(campo("IdEstAct") ?? "", 10)
  return {
    numeroGuia: campo("NumGui") ?? numeroGuia,
    estadoActual,
    idEstado: Number.isFinite(id) ? id : null,
    fechaEstado: campo("FecEst"),
    // La documentación trae "2020 -06-23": se quitan los espacios.
    fechaProbable: campo("FechaProbable")?.replace(/\s+/g, "") ?? null,
    fechaEnvio,
    ciudadOrigen: campo("CiuRem"),
    ciudadDestino: campo("CiuDes"),
    receptor: campo("NomRec") ?? campo("quienrecibe"),
    movimientos,
    mensajeImagen: campo("MensajeBuscarImagen"),
    sinDatos: false,
  }
}

function vacia(numeroGuia: string): TrazabilidadGuia {
  return {
    numeroGuia,
    estadoActual: null,
    idEstado: null,
    fechaEstado: null,
    fechaProbable: null,
    fechaEnvio: null,
    ciudadOrigen: null,
    ciudadDestino: null,
    receptor: null,
    movimientos: [],
    mensajeImagen: null,
    sinDatos: true,
  }
}

// Charset de la respuesta: el del Content-Type, si no el de la declaración
// XML (QA usa ISO-8859-1) y, si no hay ninguno, UTF-8.
export function decodificarRespuesta(cuerpo: Buffer, contentType: string): string {
  const declarado =
    /charset=([^;]+)/i.exec(contentType)?.[1] ??
    /^<\?xml[^>]*encoding=["']([^"']+)["']/i.exec(cuerpo.subarray(0, 200).toString("latin1"))?.[1]
  const charset = declarado?.trim().toLowerCase()
  const latin1 = charset === "iso-8859-1" || charset === "latin1" || charset === "windows-1252"
  return cuerpo.toString(latin1 ? "latin1" : "utf8")
}

export async function consultarTrazabilidad(config: ConfigServientrega, numeroGuia: string): Promise<TrazabilidadGuia> {
  if (!/^\d{1,15}$/.test(numeroGuia)) {
    throw new ServientregaError("rechazada", "Número de guía inválido para la trazabilidad")
  }
  const url = new URL(config.endpoints.trazabilidad)
  const respuesta = await solicitarHttps({
    url,
    metodo: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      Accept: "text/xml",
      SOAPAction: `"${url.origin}${url.pathname}/ConsultarGuiaImagen"`,
    },
    cuerpo: sobreConsulta(numeroGuia),
    // Certificado propio del host (*.appsiscore.com): validación por defecto.
    tls: {},
    operacion: "trazabilidad",
    // Es una consulta: se puede repetir sin efectos.
    reintentable: true,
    redactar: (texto) => texto,
  })
  const texto = decodificarRespuesta(respuesta.cuerpo, respuesta.contentType)
  // Un SOAP Fault llega con 500 y cuerpo XML: lo interpreta el parser.
  if ((respuesta.status < 200 || respuesta.status >= 300) && !/faultstring/i.test(texto)) {
    throw new ServientregaError(
      "http",
      `Servientrega respondió con un error en la trazabilidad (HTTP ${respuesta.status})`,
      respuesta.status,
    )
  }
  return parsearTrazabilidad(texto, numeroGuia)
}
