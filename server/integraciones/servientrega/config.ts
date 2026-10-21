import "server-only"

import { z } from "zod"
import { SERVIENTREGA_NO_CONFIGURADA } from "@/lib/servientrega"
import { ServientregaError } from "./errores"

// Configuración de la integración desde variables de entorno.
//
// - SERVIENTREGA_AMBIENTE=qa|prod. Sin ella la integración queda deshabilitada
//   (la UI muestra "Integración con Servientrega no configurada"); nunca rompe
//   la app.
// - SERVIENTREGA_USUARIO / SERVIENTREGA_PASSWORD: credenciales de Servicli.
// - SERVIENTREGA_TRAZABILIDAD_URL (opcional): endpoint SOAP de trazabilidad;
//   por defecto el del ambiente.
// - SERVIENTREGA_PROXY_URL (opcional): proxy de salida con IP fija para
//   producción en Vercel Hobby. Ver ARQUITECTURA.md.
// - SERVIENTREGA_REMITENTE_*: datos del remitente de las guías. Solo los exige
//   la generación de guías; listar ciudades, anular y descargar funcionan sin ellos.
//
// Producción exige que la IP pública desde la que se llama esté registrada en
// Servientrega (ver ARQUITECTURA.md, "Integración Servientrega").

export type AmbienteServientrega = "qa" | "prod"

interface Endpoints {
  // ciudades y guiawebs.
  api: string
  // GuiasWeb (PDF A4) e ImprimeRotulos.
  documentos: string
  // QA se publica por IP con un certificado válido para servientrega.com.ec:
  // se valida contra ese nombre (SNI + checkServerIdentity), sin desactivar
  // la verificación TLS. En prod el host ya coincide con el certificado.
  tlsServername: string | null
  // Servicio SOAP de trazabilidad (otro host, con certificado propio). Se
  // puede reemplazar con SERVIENTREGA_TRAZABILIDAD_URL.
  trazabilidad: string
}

export const ENDPOINTS: Record<AmbienteServientrega, Endpoints> = {
  qa: {
    api: "https://181.39.87.158:8021",
    documentos: "https://181.39.87.158:7777",
    tlsServername: "servientrega.com.ec",
    trazabilidad: "https://servientrega-ecuador-prueba.appsiscore.com/app/ws/server_trazabilidad.php",
  },
  prod: {
    api: "https://swservicli.servientrega.com.ec:5052",
    documentos: "https://swservicli.servientrega.com.ec:5001",
    tlsServername: null,
    trazabilidad: "https://servientrega-ecuador.appsiscore.com/app/ws/server_trazabilidad.php",
  },
}

// Las credenciales viajan dentro de la ruta como ['usuario','contraseña']: una
// comilla simple rompería ese formato.
const credencial = (nombre: string) =>
  z
    .string({ error: `Falta ${nombre}` })
    .trim()
    .min(1, `Falta ${nombre}`)
    .refine((v) => !v.includes("'"), `${nombre} no puede contener comillas simples`)

// Endpoint SOAP sin "?wsdl" (se acepta con él y se quita).
const trazabilidadUrl = z
  .string()
  .trim()
  .transform((v) => v.replace(/\?.*$/, ""))
  .pipe(
    z.url({ protocol: /^https$/, error: "SERVIENTREGA_TRAZABILIDAD_URL debe ser una URL https" }),
  )
  .optional()

// Proxy de salida con IP fija (QuotaGuard Static, Fixie…):
// http(s)://usuario:clave@host:puerto. Los mensajes nunca repiten el valor
// (lleva credenciales).
const proxyUrl = z
  .string()
  .trim()
  .refine((v) => {
    try {
      const u = new URL(v)
      return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname && !!u.port && u.pathname.length <= 1
    } catch {
      return false
    }
  }, "SERVIENTREGA_PROXY_URL debe tener el formato http(s)://usuario:clave@host:puerto")
  .optional()

const configSchema = z.object({
  SERVIENTREGA_AMBIENTE: z.enum(["qa", "prod"], { error: "SERVIENTREGA_AMBIENTE debe ser qa o prod" }),
  SERVIENTREGA_USUARIO: credencial("SERVIENTREGA_USUARIO"),
  SERVIENTREGA_PASSWORD: credencial("SERVIENTREGA_PASSWORD"),
  SERVIENTREGA_TRAZABILIDAD_URL: trazabilidadUrl,
  SERVIENTREGA_PROXY_URL: proxyUrl,
})

export interface ConfigServientrega {
  ambiente: AmbienteServientrega
  usuario: string
  password: string
  endpoints: Endpoints
  // Si está, todas las llamadas salen por este proxy (HTTP CONNECT).
  proxyUrl: string | null
}

type Env = Record<string, string | undefined>

export type EstadoIntegracion =
  | { habilitada: true; ambiente: AmbienteServientrega }
  | { habilitada: false; motivo: string }

function vacio(valor: string | undefined) {
  return !valor || !valor.trim()
}

function parsearConfig(env: Env): { ok: true; config: ConfigServientrega } | { ok: false; motivo: string } {
  if (vacio(env.SERVIENTREGA_AMBIENTE)) return { ok: false, motivo: SERVIENTREGA_NO_CONFIGURADA }
  const parsed = configSchema.safeParse({
    SERVIENTREGA_AMBIENTE: env.SERVIENTREGA_AMBIENTE?.trim().toLowerCase(),
    SERVIENTREGA_USUARIO: env.SERVIENTREGA_USUARIO,
    SERVIENTREGA_PASSWORD: env.SERVIENTREGA_PASSWORD,
    SERVIENTREGA_TRAZABILIDAD_URL: vacio(env.SERVIENTREGA_TRAZABILIDAD_URL) ? undefined : env.SERVIENTREGA_TRAZABILIDAD_URL,
    SERVIENTREGA_PROXY_URL: vacio(env.SERVIENTREGA_PROXY_URL) ? undefined : env.SERVIENTREGA_PROXY_URL,
  })
  if (!parsed.success) {
    return { ok: false, motivo: `${SERVIENTREGA_NO_CONFIGURADA}: ${parsed.error.issues[0]?.message ?? "configuración inválida"}` }
  }
  const ambiente = parsed.data.SERVIENTREGA_AMBIENTE
  return {
    ok: true,
    config: {
      ambiente,
      usuario: parsed.data.SERVIENTREGA_USUARIO,
      password: parsed.data.SERVIENTREGA_PASSWORD,
      endpoints: {
        ...ENDPOINTS[ambiente],
        trazabilidad: parsed.data.SERVIENTREGA_TRAZABILIDAD_URL ?? ENDPOINTS[ambiente].trazabilidad,
      },
      proxyUrl: parsed.data.SERVIENTREGA_PROXY_URL ?? null,
    },
  }
}

// Para la UI: si los botones se habilitan y, si no, por qué.
export function estadoIntegracion(env: Env = process.env): EstadoIntegracion {
  const r = parsearConfig(env)
  return r.ok ? { habilitada: true, ambiente: r.config.ambiente } : { habilitada: false, motivo: r.motivo }
}

export function leerConfig(env: Env = process.env): ConfigServientrega {
  const r = parsearConfig(env)
  if (!r.ok) throw new ServientregaError("no_configurada", r.motivo)
  return r.config
}

// --- Remitente ------------------------------------------------------------------

const texto = (nombre: string, max: number) =>
  z
    .string({ error: nombre })
    .trim()
    .min(1, nombre)
    .max(max, `${nombre} admite hasta ${max} caracteres`)

const remitenteSchema = z.object({
  identificacion: texto("SERVIENTREGA_REMITENTE_ID", 20),
  razon_social: texto("SERVIENTREGA_REMITENTE_RAZON_SOCIAL", 100),
  nombre: texto("SERVIENTREGA_REMITENTE_NOMBRE", 100),
  apellido: texto("SERVIENTREGA_REMITENTE_APELLIDO", 100),
  direccion: texto("SERVIENTREGA_REMITENTE_DIRECCION", 200),
  telefono: texto("SERVIENTREGA_REMITENTE_TELEFONO", 20),
  ciudad_id: z.coerce
    .number({ error: "SERVIENTREGA_REMITENTE_CIUDAD_ID" })
    .int("SERVIENTREGA_REMITENTE_CIUDAD_ID debe ser un id de ciudad de Servientrega")
    .positive("SERVIENTREGA_REMITENTE_CIUDAD_ID debe ser un id de ciudad de Servientrega"),
  sector: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v ?? ""),
})

export type Remitente = z.output<typeof remitenteSchema>

const VARIABLES_REMITENTE = {
  identificacion: "SERVIENTREGA_REMITENTE_ID",
  razon_social: "SERVIENTREGA_REMITENTE_RAZON_SOCIAL",
  nombre: "SERVIENTREGA_REMITENTE_NOMBRE",
  apellido: "SERVIENTREGA_REMITENTE_APELLIDO",
  direccion: "SERVIENTREGA_REMITENTE_DIRECCION",
  telefono: "SERVIENTREGA_REMITENTE_TELEFONO",
  ciudad_id: "SERVIENTREGA_REMITENTE_CIUDAD_ID",
} as const

export function leerRemitente(env: Env = process.env): Remitente {
  const faltan = Object.values(VARIABLES_REMITENTE).filter((nombre) => vacio(env[nombre]))
  if (faltan.length > 0) {
    throw new ServientregaError("no_configurada", `Faltan datos del remitente de Servientrega: ${faltan.join(", ")}`)
  }
  const parsed = remitenteSchema.safeParse({
    identificacion: env.SERVIENTREGA_REMITENTE_ID,
    razon_social: env.SERVIENTREGA_REMITENTE_RAZON_SOCIAL,
    nombre: env.SERVIENTREGA_REMITENTE_NOMBRE,
    apellido: env.SERVIENTREGA_REMITENTE_APELLIDO,
    direccion: env.SERVIENTREGA_REMITENTE_DIRECCION,
    telefono: env.SERVIENTREGA_REMITENTE_TELEFONO,
    ciudad_id: env.SERVIENTREGA_REMITENTE_CIUDAD_ID,
    sector: vacio(env.SERVIENTREGA_REMITENTE_SECTOR) ? undefined : env.SERVIENTREGA_REMITENTE_SECTOR,
  })
  if (!parsed.success) {
    throw new ServientregaError(
      "no_configurada",
      `Datos del remitente de Servientrega inválidos: ${parsed.error.issues[0]?.message ?? ""}`,
    )
  }
  return parsed.data
}
