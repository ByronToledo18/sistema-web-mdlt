import { NextResponse } from "next/server"
import { revalidarCatalogo } from "@/lib/catalogo-cache"
import { withAuth } from "@/server/auth/guard"
import { crearServicio, listarServicios } from "@/server/services/catalogo"
import { listarCatalogoQuery, servicioBody } from "@/server/validators/catalogo"
import { parseBody, parseQuery } from "@/server/validators/common"

// GET - Listar servicios
export const GET = withAuth(
  { permission: { module: "servicios", action: "read" }, error: "Error al obtener servicios" },
  async (request) => {
    const filtros = parseQuery(request, listarCatalogoQuery)
    return NextResponse.json({ servicios: await listarServicios(filtros) })
  },
)

// POST - Crear servicio
export const POST = withAuth(
  { permission: { module: "servicios", action: "create" }, error: "Error al crear servicio" },
  async (request) => {
    const datos = await parseBody(request, servicioBody)
    const servicio = await crearServicio(datos)
    revalidarCatalogo()
    return NextResponse.json({ servicio }, { status: 201 })
  },
)
