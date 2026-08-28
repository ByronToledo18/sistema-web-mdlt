import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { createAuditLog } from "@/lib/audit"

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(["administrador"])
    const userId = Number.parseInt((await params).id)

    // Get user info before deletion
    const [targetUser] = await sql`
      SELECT u.nombre, u.email, u.activo, r.nombre as rol_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE u.id = ${userId}
    `

    if (!targetUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    // Check if this is the last active administrator
    if (targetUser.rol_nombre === "administrador" && targetUser.activo) {
      const [adminCount] = await sql`
        SELECT COUNT(*) as count
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE r.nombre = 'administrador' AND u.activo = true
      `

      if (Number(adminCount.count) <= 1) {
        return NextResponse.json(
          { error: "No se puede eliminar el último administrador activo del sistema" },
          { status: 400 },
        )
      }
    }

    // Check if this is the last active support user
    if (targetUser.rol_nombre === "soporte" && targetUser.activo) {
      const [soporteCount] = await sql`
        SELECT COUNT(*) as count
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE r.nombre = 'soporte' AND u.activo = true
      `

      if (Number(soporteCount.count) <= 1) {
        return NextResponse.json(
          { error: "No se puede eliminar el último usuario de soporte activo del sistema" },
          { status: 400 },
        )
      }
    }

    // Delete user
    await sql`
      DELETE FROM usuarios WHERE id = ${userId}
    `

    // Create audit log
    await createAuditLog({
      usuario_id: user.id,
      accion: "ELIMINAR_USUARIO",
      modulo: "usuarios",
      descripcion: `Eliminó al usuario ${targetUser.nombre} (${targetUser.email})`,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Delete user error:", error)
    return NextResponse.json(
      { error: error.message || "Error al eliminar usuario" },
      { status: error.message?.includes("No autorizado") ? 401 : 500 },
    )
  }
}
