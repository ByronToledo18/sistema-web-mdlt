import { GoogleGenAI } from "@google/genai"

// gemini-3.1-flash-image (no usar gemini-2.5-flash-image: Google anunció su
// discontinuación para el 2 de octubre de 2026).
const IMAGE_MODEL = "gemini-3.1-flash-image"

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY no está configurada")
  }
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  }
  return client
}

// Genera una imagen a partir de una descripción de texto y devuelve los
// bytes de la imagen (PNG) listos para subir a Vercel Blob.
export async function generarImagenDiseno(descripcion: string): Promise<Buffer> {
  const ai = getClient()

  const prompt = `Genera una fotografía realista de un tutú de ballet/disfraz infantil hecho a medida según esta descripción del cliente: "${descripcion}". Estilo: foto de producto profesional, fondo neutro claro, bien iluminado, el tutú centrado y completo en el encuadre.`

  const interaction = await ai.interactions.create({
    model: IMAGE_MODEL,
    input: prompt,
    response_format: {
      type: "image",
      mime_type: "image/png",
      aspect_ratio: "1:1",
    },
  })

  const base64Data = interaction.output_image?.data
  if (!base64Data) {
    throw new Error("La API de Gemini no devolvió una imagen")
  }

  return Buffer.from(base64Data, "base64")
}
