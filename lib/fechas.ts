// Fechas de calendario del negocio: zona America/Guayaquil (Ecuador
// continental), UTC-5 fijo, sin horario de verano.
//
// El servidor (Vercel, Neon) corre en UTC: new Date().getFullYear(),
// toISOString() o CURRENT_DATE dan el día/mes/año de UTC, que entre las 19:00
// y las 24:00 de Ecuador ya es el día siguiente. En los bordes de mes y año
// eso mandaba cobros, guías y facturas al período equivocado. Todo lo que
// dependa del "día de hoy" del negocio pasa por aquí.
//
// Es un desplazamiento fijo (no Intl) a propósito: Ecuador no cambia de hora
// y así el cálculo es idéntico en cualquier runtime.

export const ZONA_NEGOCIO = "America/Guayaquil"
const OFFSET_MS = -5 * 60 * 60 * 1000
const DIA_MS = 24 * 60 * 60 * 1000

// El instante `ahora` visto como fecha de pared en Ecuador (usar getUTC*).
function enEcuador(ahora: Date): Date {
  return new Date(ahora.getTime() + OFFSET_MS)
}

export interface FechaNegocio {
  year: number
  month: number // 1–12
  day: number
}

export function fechaNegocio(ahora: Date = new Date()): FechaNegocio {
  const d = enEcuador(ahora)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

export function anioNegocio(ahora: Date = new Date()): number {
  return fechaNegocio(ahora).year
}

// "YYYY-MM"
export function periodoNegocio(ahora: Date = new Date()): string {
  return enEcuador(ahora).toISOString().slice(0, 7)
}

// "YYYY-MM-DD"
export function hoyNegocio(ahora: Date = new Date()): string {
  return enEcuador(ahora).toISOString().slice(0, 10)
}

// Instante en que empieza (00:00 en Ecuador) el día "YYYY-MM-DD".
export function inicioDelDia(dia: string): Date {
  return new Date(`${dia.slice(0, 10)}T00:00:00-05:00`)
}

// Rango de instantes [desde 00:00, día siguiente a `hasta` 00:00) para filtrar
// columnas timestamp por días del calendario de Ecuador, ambos incluidos.
export function rangoDeDias(desde: string, hasta: string): { inicio: Date; fin: Date } {
  return { inicio: inicioDelDia(desde), fin: new Date(inicioDelDia(hasta).getTime() + DIA_MS) }
}
