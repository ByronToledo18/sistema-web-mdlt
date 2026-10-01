import { put } from "@vercel/blob"
import { NextResponse } from "next/server"
import { HttpError } from "@/lib/http"
import { withAuth } from "@/server/auth/guard"

const MAX_BYTES = 5 * 1024 * 1024 // 5MB

// Formatos aceptados, identificados por sus primeros bytes ("magic bytes").
// No se confía en file.type ni en la extensión: los manda el navegador y se
// pueden falsificar para subir HTML o SVG con scripts al dominio del blob.
const FORMATOS = [
  { ext: "jpg", type: "image/jpeg", matches: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: "png",
    type: "image/png",
    matches: (b: Uint8Array) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v),
  },
  {
    ext: "webp",
    type: "image/webp",
    matches: (b: Uint8Array) =>
      String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP",
  },
]

// "Foto Tutú Rosa (1).PNG" -> "foto-tutu-rosa-1"
function slugify(nombre: string): string {
  return (
    nombre
      .replace(/\.[^.]*$/, "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "imagen"
  )
}

// POST - Subir la imagen de un producto o servicio a Vercel Blob. Solo la usan
// los formularios del inventario, así que exige poder editar productos.
export const POST = withAuth(
  { permission: { module: "productos", action: "update" }, error: "Error al subir el archivo" },
  async (request) => {
    const file = (await request.formData()).get("file")
    if (!(file instanceof File)) {
      throw new HttpError(400, "No se proporcionó ningún archivo")
    }
    if (file.size > MAX_BYTES) {
      throw new HttpError(400, "El archivo es demasiado grande (máximo 5MB)")
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const formato = FORMATOS.find((f) => f.matches(bytes))
    if (!formato) {
      throw new HttpError(400, "Solo se permiten imágenes JPG, PNG o WEBP")
    }

    // Nombre saneado con la extensión real; addRandomSuffix evita colisiones y
    // que se puedan adivinar las URLs de otras imágenes.
    const filename = `${slugify(file.name)}.${formato.ext}`
    const blob = await put(filename, bytes, {
      access: "public",
      contentType: formato.type,
      addRandomSuffix: true,
    })

    return NextResponse.json({ url: blob.url, filename, size: file.size, type: formato.type })
  },
)
