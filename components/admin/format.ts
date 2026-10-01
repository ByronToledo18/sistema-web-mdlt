// Formatos compartidos por las páginas del admin (servidor y cliente).

const currency = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" })

export function formatCurrency(value: string | number | null | undefined): string {
  return currency.format(typeof value === "number" ? value : Number.parseFloat(value ?? "0"))
}

// La zona horaria va fija: estas fechas se renderizan en el servidor (UTC en
// Vercel) y se hidratan en el navegador, y ambos deben dar el mismo texto.
export const TIME_ZONE = "America/Guayaquil"

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return ""
  return new Date(value).toLocaleString("es-EC", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Columnas `date` ("YYYY-MM-DD"): se formatean en UTC porque new Date() las
// interpreta como medianoche UTC y en Ecuador mostrarían el día anterior.
export function formatDate(value: string | null | undefined): string {
  if (!value) return ""
  return new Date(value).toLocaleDateString("es-EC", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" })
}
