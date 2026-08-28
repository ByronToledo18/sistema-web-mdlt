import { type NextRequest, NextResponse } from "next/server"
import { requireAuth, hashPassword } from "@/lib/auth"
import { sql } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(["soporte", "administrador"])

    const { nueva_password } = await request.json()

    if (!nueva_password || nueva_password.length < 6) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 })
    }

    const hashedPassword = await hashPassword(nueva_password)

    await sql`
      UPDATE usuarios
      SET hash_password = ${hashedPassword},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${(await params).id}
    `

    // Registrar en auditoría
    await createAuditLog({
      usuario_id: user.id,
      accion: "RESET_PASSWORD",
      modulo: "usuarios",
      descripcion: `Contraseña reseteada para usuario ID ${(await params).id}`,
    })

    return NextResponse.json({
      success: true,
      message: "Contraseña actualizada correctamente",
    })
  } catch (error) {
    console.error("[v0] Error resetting password:", error)
    return NextResponse.json({ error: "Error al resetear contraseña" }, { status: 500 })
  }
}
