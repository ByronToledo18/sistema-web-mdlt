import { put } from "@vercel/blob"
import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireAuth(["administrador", "asistente"])

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 })
    }

    // Validate file type (only images)
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Solo se permiten archivos de imagen" }, { status: 400 })
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: "El archivo es demasiado grande (máximo 5MB)" }, { status: 400 })
    }

    // Generate unique filename with timestamp
    const timestamp = Date.now()
    const filename = `${timestamp}-${file.name}`

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
    })

    console.log("[v0] Image uploaded successfully:", blob.url)

    return NextResponse.json({
      url: blob.url,
      filename: file.name,
      size: file.size,
      type: file.type,
    })
  } catch (error) {
    console.error("[v0] Upload error:", error)
    return NextResponse.json({ error: "Error al subir el archivo" }, { status: 500 })
  }
}
