import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { hashPassword } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json()

    if (!token || !newPassword) {
      return NextResponse.json({ error: "Token y nueva contraseña son requeridos" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }

    const result = await sql`
      SELECT id, reset_token_expiry
      FROM clientes
      WHERE reset_token = ${token}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Enlace inválido o ya utilizado" }, { status: 400 })
    }

    const cliente = result[0]

    if (!cliente.reset_token_expiry || new Date(cliente.reset_token_expiry) < new Date()) {
      return NextResponse.json({ error: "El enlace ha expirado. Solicita uno nuevo." }, { status: 400 })
    }

    const hashedPassword = await hashPassword(newPassword)

    // Un solo uso: se limpian el token y su expiración al consumirse.
    await sql`
      UPDATE clientes
      SET hash_password = ${hashedPassword}, reset_token = NULL, reset_token_expiry = NULL, debe_cambiar_password = false
      WHERE id = ${cliente.id}
    `

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Reset password error:", error)
    return NextResponse.json({ error: error.message || "Error al restablecer la contraseña" }, { status: 500 })
  }
}
