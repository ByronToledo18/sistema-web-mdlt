import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { hashPassword, verifyPassword, getClienteFromToken } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const clienteToken = await getClienteFromToken()

    if (!clienteToken) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Contraseña actual y nueva son requeridas" }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "La nueva contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }

    // Obtener cliente
    const result = await sql`
      SELECT id, hash_password
      FROM clientes
      WHERE id = ${clienteToken.id}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    const cliente = result[0]

    // Verificar contraseña actual
    const isValid = await verifyPassword(currentPassword, cliente.hash_password)

    if (!isValid) {
      return NextResponse.json({ error: "La contraseña actual es incorrecta" }, { status: 401 })
    }

    // Hash de la nueva contraseña
    const hashedPassword = await hashPassword(newPassword)

    // Actualizar contraseña
    await sql`
      UPDATE clientes
      SET hash_password = ${hashedPassword}
      WHERE id = ${cliente.id}
    `

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Change password error:", error)
    return NextResponse.json({ error: error.message || "Error al cambiar contraseña" }, { status: 500 })
  }
}
