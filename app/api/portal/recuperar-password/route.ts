import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "El email es requerido" }, { status: 400 })
    }

    // Buscar cliente
    const result = await sql`
      SELECT id, nombre, email
      FROM clientes
      WHERE email = ${email}
    `

    if (result.length === 0) {
      // Por seguridad, no revelamos si el email existe o no
      return NextResponse.json({ success: true })
    }

    const cliente = result[0]

    // Generar token de reseteo
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hora

    // Guardar token en la base de datos
    await sql`
      UPDATE clientes
      SET reset_token = ${resetToken}, reset_token_expiry = ${resetTokenExpiry}
      WHERE id = ${cliente.id}
    `

    // TODO: Enviar email con el link de reseteo
    // Por ahora, crear un ticket de soporte
    await sql`
      INSERT INTO soporte_tickets (tipo, prioridad, descripcion, estado, email_contacto)
      VALUES (
        'reseteo_contraseña',
        'alta',
        ${`Solicitud de reseteo de contraseña para: ${cliente.nombre} (${cliente.email})\n\nToken: ${resetToken}`},
        'abierto',
        ${cliente.email}
      )
    `

    console.log(`[v0] Password reset token for ${email}: ${resetToken}`)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Password recovery error:", error)
    return NextResponse.json({ error: error.message || "Error al procesar solicitud" }, { status: 500 })
  }
}
