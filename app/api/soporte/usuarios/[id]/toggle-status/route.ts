import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { sql } from "@/lib/db"
import { createAuditLog } from "@/lib/audit"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth(["soporte", "administrador"])

    const [targetUser] = await sql`
      SELECT u.activo, r.nombre as rol_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE u.id = ${params.id}
    `

    if (!targetUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    if (targetUser.activo && targetUser.rol_nombre === "administrador") {
      const [adminCount] = await sql`
        SELECT COUNT(*) as count
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE r.nombre = 'administrador' AND u.activo = true
      `

      if (Number(adminCount.count) <= 1) {
        return NextResponse.json(
          { error: "No se puede desactivar el último administrador activo del sistema" },
          { status: 400 },
        )
      }
    }

    if (targetUser.activo && targetUser.rol_nombre === "soporte") {
      const [soporteCount] = await sql`
        SELECT COUNT(*) as count
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE r.nombre = 'soporte' AND u.activo = true
      `

      if (Number(soporteCount.count) <= 1) {
        return NextResponse.json(
          { error: "No se puede desactivar el último usuario de soporte activo del sistema" },
          { status: 400 },
        )
      }
    }

    const result = await sql`
      UPDATE usuarios
      SET activo = NOT activo,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${params.id}
      RETURNING activo
    `

    const nuevoEstado = result[0].activo

    // Registrar en auditoría
    await createAuditLog({
      usuario_id: user.id,
      accion: nuevoEstado ? "ACTIVAR_USUARIO" : "DESACTIVAR_USUARIO",
      modulo: "usuarios",
      descripcion: `Usuario ID ${params.id} ${nuevoEstado ? "activado" : "desactivado"}`,
    })

    return NextResponse.json({
      success: true,
      activo: nuevoEstado,
    })
  } catch (error) {
    console.error("[v0] Error toggling user status:", error)
    return NextResponse.json({ error: "Error al cambiar estado del usuario" }, { status: 500 })
  }
}
