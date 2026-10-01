import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { registrarAuditoria } from "@/server/services/auditoria"
import { crearUsuario, listarUsuarios } from "@/server/services/usuarios"
import { parseBody } from "@/server/validators/common"
import { crearUsuarioBody } from "@/server/validators/usuarios"

// GET - Listar usuarios internos
export const GET = withAuth(
  { permission: { module: "usuarios", action: "read" }, error: "Error al obtener usuarios" },
  async () => NextResponse.json(await listarUsuarios()),
)

// POST - Crear usuario interno
export const POST = withAuth(
  { permission: { module: "usuarios", action: "create" }, error: "Error al crear usuario" },
  async (request, _context, user) => {
    const input = await parseBody(request, crearUsuarioBody)
    const usuario = await crearUsuario(input)

    await registrarAuditoria({
      usuario_id: user.id,
      accion: "CREAR",
      modulo: "usuarios",
      descripcion: `Creó el usuario ${usuario.nombre} (${usuario.email})`,
    })

    return NextResponse.json(usuario, { status: 201 })
  },
)
