// Destino seguro para el parámetro ?redirect= del login.
//
// Solo se aceptan rutas internas absolutas ("/admin/pedidos?x=1"). Se rechaza
// todo lo que un navegador podría interpretar como otro origen:
// - "https://otro.sitio" o "javascript:..." (no empiezan con "/").
// - "//otro.sitio" (URL relativa al protocolo).
// - "/\otro.sitio": los navegadores tratan "\" como "/".
// - Caracteres de control: el navegador elimina tabs y saltos de línea de las
//   URLs, así que "/\t/otro.sitio" termina siendo "//otro.sitio".
export const DEFAULT_ADMIN_REDIRECT = "/admin/dashboard"

export function sanitizeRedirect(value: string | null | undefined, fallback = DEFAULT_ADMIN_REDIRECT): string {
  if (!value || !value.startsWith("/")) return fallback
  if (value.startsWith("//") || value.includes("\\")) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback
  return value
}
