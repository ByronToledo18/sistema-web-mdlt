import { type NextRequest, NextResponse } from "next/server"
import { put } from "@vercel/blob"
import { sql } from "@/lib/db"
import { getClienteFromToken } from "@/lib/auth"
import { generarImagenDiseno } from "@/lib/gemini"

const MAX_DISENOS_POR_DIA = 5

// POST - Generar un diseño personalizado de tutú con IA a partir de una
// descripción del cliente. Requiere sesión del portal (no es un endpoint
// público) porque cada llamada tiene costo real en la API de Gemini.
export async function POST(request: NextRequest) {
  try {
    const cliente = await getClienteFromToken()
    if (!cliente) {
      return NextResponse.json({ error: "Debes iniciar sesión para diseñar tu tutú" }, { status: 401 })
    }

    const { descripcion } = await request.json()

    if (!descripcion || typeof descripcion !== "string" || descripcion.trim().length < 10) {
      return NextResponse.json(
        { error: "Describe tu diseño con al menos 10 caracteres" },
        { status: 400 },
      )
    }

    if (descripcion.length > 500) {
      return NextResponse.json({ error: "La descripción es demasiado larga (máximo 500 caracteres)" }, { status: 400 })
    }

    // Límite diario por cliente - cada generación cuesta dinero real en la
    // API de Gemini, esto evita que una cuenta comprometida o un loop de
    // errores en el frontend genere un gasto descontrolado.
    const hoy = await sql`
      SELECT COUNT(*) as count FROM disenos_personalizados
      WHERE cliente_id = ${cliente.id} AND created_at >= CURRENT_DATE
    `
    if (Number.parseInt(hoy[0].count) >= MAX_DISENOS_POR_DIA) {
      return NextResponse.json(
        { error: `Alcanzaste el límite de ${MAX_DISENOS_POR_DIA} diseños por día. Intenta de nuevo mañana.` },
        { status: 429 },
      )
    }

    const imagenBuffer = await generarImagenDiseno(descripcion.trim())

    const filename = `disenos/${cliente.id}-${Date.now()}.png`
    const blob = await put(filename, imagenBuffer, {
      access: "public",
      contentType: "image/png",
    })

    const result = await sql`
      INSERT INTO disenos_personalizados (cliente_id, descripcion, imagen_url, estado)
      VALUES (${cliente.id}, ${descripcion.trim()}, ${blob.url}, 'generado')
      RETURNING *
    `

    return NextResponse.json({ diseno: result[0] }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Generar diseño error:", error)
    return NextResponse.json({ error: error.message || "Error al generar el diseño" }, { status: 500 })
  }
}

// GET - Listar los diseños generados por el cliente autenticado
export async function GET(request: NextRequest) {
  try {
    const cliente = await getClienteFromToken()
    if (!cliente) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    const disenos = await sql`
      SELECT * FROM disenos_personalizados
      WHERE cliente_id = ${cliente.id}
      ORDER BY created_at DESC
    `

    return NextResponse.json({ disenos })
  } catch (error: any) {
    console.error("[v0] Get disenos error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener diseños" }, { status: 500 })
  }
}
