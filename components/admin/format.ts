// Formatos compartidos por las páginas del admin (servidor y cliente).

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" })

export function formatCurrency(value: string | number | null | undefined): string {
  return currency.format(typeof value === "number" ? value : Number.parseFloat(value ?? "0"))
}

// La zona horaria va fija: estas fechas se renderizan en el servidor (UTC en
// Vercel) y se hidratan en el navegador, y ambos deben dar el mismo texto.
export const TIME_ZONE = "America/Guayaquil"

export function formatDateTime(value: string | Date | null | undefined, month: "long" | "short" = "long"): string {
  if (!value) return ""
  return new Date(value).toLocaleString("es-EC", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month,
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Fecha sin hora. Las columnas `timestamp` llegan como Date y se muestran en
// la hora de Ecuador; las columnas `date` llegan como "YYYY-MM-DD" y se
// formatean en UTC, porque new Date() las interpreta como medianoche UTC y en
// Ecuador mostrarían el día anterior.
export function formatDate(value: string | Date | null | undefined, month: "long" | "short" = "long"): string {
  if (!value) return ""
  const timeZone = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? "UTC" : TIME_ZONE
  return new Date(value).toLocaleDateString("es-EC", { timeZone, year: "numeric", month, day: "numeric" })
}

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]
