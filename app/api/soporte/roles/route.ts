import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { listarRoles } from "@/server/services/usuarios"

// GET - Listar roles
export const GET = withAuth(
  { permission: { module: "usuarios", action: "read" }, error: "Error al obtener roles" },
  async () => NextResponse.json(await listarRoles()),
)
