// Datos y funciones puras de la integración con Servientrega que comparten el
// servidor y los componentes del admin (no importa nada de servidor).
// La integración en sí vive en server/integraciones/servientrega/.

export const PRODUCTOS_SERVIENTREGA = [
  { id: 1, nombre: "Documento unitario" },
  { id: 2, nombre: "Mercancía Premier" },
  { id: 3, nombre: "Documento masivo" },
  { id: 6, nombre: "Mercancía industrial" },
  { id: 8, nombre: "Valija empresarial" },
  { id: 71, nombre: "Farma" },
] as const

export type ProductoServientregaId = (typeof PRODUCTOS_SERVIENTREGA)[number]["id"]
export const PRODUCTO_SERVIENTREGA_IDS = PRODUCTOS_SERVIENTREGA.map((p) => p.id) as ProductoServientregaId[]

// Valores por defecto del diálogo "Generar guía Servientrega".
export const GUIA_DEFAULTS = {
  producto_id: 2 as ProductoServientregaId,
  peso_kg: 0.5,
  piezas: 1,
  contenido: "Tutú / prendas",
}

export const SERVIENTREGA_NO_CONFIGURADA = "Integración con Servientrega no configurada"

export interface CiudadServientrega {
  id: number
  nombre: string
}

// Mayúsculas, sin tildes ni espacios repetidos: "Quitó  sur" → "QUITO SUR".
export function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()
}

// Servientrega nombra las ciudades como "QUITO (PICHINCHA)" o
// "SANTA ROSA (AMBATO) (TUNGURAHUA)": el nombre base es lo que va antes del
// primer paréntesis.
function nombreBase(nombre: string): string {
  return normalizarTexto(nombre.split("(")[0] ?? nombre)
}

// Sugiere la ciudad de Servientrega a partir de la ciudad del pedido y, si no
// hay coincidencia, buscando el nombre de alguna ciudad dentro de la dirección.
// Devuelve el id o null; el admin siempre confirma o elige otra.
export function sugerirCiudad(
  ciudades: readonly CiudadServientrega[],
  ciudadPedido: string | null | undefined,
  direccion?: string | null,
): number | null {
  const bases = ciudades.map((c) => ({ id: c.id, base: nombreBase(c.nombre), completo: normalizarTexto(c.nombre) }))

  if (ciudadPedido && normalizarTexto(ciudadPedido)) {
    const buscada = normalizarTexto(ciudadPedido)
    const exacta = bases.find((c) => c.base === buscada || c.completo === buscada)
    if (exacta) return exacta.id
    // "Quito, Pichincha" o "Quito - Pichincha": primera parte.
    const primera = normalizarTexto(buscada.split(/[,\-/(]/)[0] ?? "")
    const porPrimera = primera ? bases.find((c) => c.base === primera) : undefined
    if (porPrimera) return porPrimera.id
  }

  if (direccion) {
    const dir = ` ${normalizarTexto(direccion).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ")} `
    // La coincidencia más larga gana ("QUITO SUR" antes que "QUITO").
    const candidatas = bases
      .filter((c) => c.base.length >= 4 && dir.includes(` ${c.base} `))
      .sort((a, b) => b.base.length - a.base.length)
    if (candidatas[0]) return candidatas[0].id
  }

  return null
}

// clientes.nombre es un solo campo; la API pide nombre y apellido por
// separado (ambos obligatorios). "Ana María Pérez López" → nombre "Ana María",
// apellido "Pérez López"; con dos o tres palabras, la primera es el nombre.
export function dividirNombre(nombreCompleto: string): { nombre: string; apellido: string } {
  const partes = nombreCompleto.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return { nombre: "", apellido: "" }
  if (partes.length === 1) return { nombre: partes[0], apellido: partes[0] }
  const corte = partes.length >= 4 ? 2 : 1
  return { nombre: partes.slice(0, corte).join(" "), apellido: partes.slice(corte).join(" ") }
}

// Rastreo público de Servientrega (no usa la API ni credenciales).
export function urlRastreoPublico(numeroGuia: string): string {
  return `https://www.servientrega.com.ec/Tracking/?guia=${encodeURIComponent(numeroGuia)}&tipo=GUIA`
}
