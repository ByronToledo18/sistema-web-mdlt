// Descarga un archivo de una ruta del admin. Si la ruta responde con error,
// devuelve el mensaje (JSON { error }) para mostrarlo; si no, null.
export async function descargarArchivo(url: string, nombre: string): Promise<string | null> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      const data = await response.json().catch(() => null)
      return data?.error ?? "Error al descargar el reporte"
    }
    const blob = await response.blob()
    const href = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = href
    a.download = nombre
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(href)
    document.body.removeChild(a)
    return null
  } catch {
    return "Error al descargar el reporte"
  }
}
