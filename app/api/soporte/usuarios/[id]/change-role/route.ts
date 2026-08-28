import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { createAuditLog } from "@/lib/audit"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth(["soporte", "administrador"])
    const { rol_id } = await request.json()
    const userId = Number.parseInt((await params).id)

    if (!rol_id) {
      return NextResponse.json({ error: "Rol requerido" }, { status: 400 })
    }

    const [targetUser] = await sql`
      SELECT u.nombre, u.email, u.rol_id, r.nombre as rol_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE u.id = ${userId}
    `

    if (!targetUser) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 })
    }

    if (targetUser.rol_nombre === "administrador" && targetUser.rol_id !== rol_id) {
      const [adminCount] = await sql`
        SELECT COUNT(*) as count
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE r.nombre = 'administrador' AND u.activo = true
      `

      if (Number(adminCount.count) <= 1) {
        return NextResponse.json(
          { error: "No se puede cambiar el rol del último administrador activo del sistema" },
          { status: 400 },
        )
      }
    }

    if (targetUser.rol_nombre === "soporte" && targetUser.rol_id !== rol_id) {
      const [soporteCount] = await sql`
        SELECT COUNT(*) as count
        FROM usuarios u
        JOIN roles r ON u.rol_id = r.id
        WHERE r.nombre = 'soporte' AND u.activo = true
      `

      if (Number(soporteCount.count) <= 1) {
        return NextResponse.json(
          { error: "No se puede cambiar el rol del último usuario de soporte activo del sistema" },
          { status: 400 },
        )
      }
    }

    // Update user role
    await sql`
      UPDATE usuarios
      SET rol_id = ${rol_id}, updated_at = NOW()
      WHERE id = ${userId}
    `

    // Create audit log
    await createAuditLog({
      usuario_id: user.id,
      accion: "CAMBIO_ROL",
      modulo: "usuarios",
      descripcion: `Cambió el rol del usuario ${targetUser.nombre} (${targetUser.email})`,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Change role error:", error)
    return NextResponse.json(
      { error: error.message || "Error al cambiar rol" },
      { status: error.message?.includes("No autorizado") ? 401 : 500 },
    )
  }
}
