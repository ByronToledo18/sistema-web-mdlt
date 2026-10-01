// Hosts que next/image puede optimizar. Debe coincidir con images.remotePatterns
// en next.config.mjs.
const OPTIMIZABLE_HOST = /\.public\.blob\.vercel-storage\.com$/

// Las imágenes subidas por el admin y las del diseñador con IA viven en Vercel
// Blob y se optimizan. Los SVG locales y cualquier URL antigua de otro dominio
// se sirven tal cual, para no romperlas.
export function isOptimizableImage(src: string): boolean {
  if (src.startsWith("/")) return !src.split("?")[0].endsWith(".svg")
  try {
    const url = new URL(src)
    return url.protocol === "https:" && OPTIMIZABLE_HOST.test(url.hostname)
  } catch {
    return false
  }
}
