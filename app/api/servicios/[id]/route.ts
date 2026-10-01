import { NextResponse } from "next/server"
import { revalidarCatalogo } from "@/lib/catalogo-cache"
import { withAuth } from "@/server/auth/guard"
import { actualizarServicio, eliminarServicio, obtenerServicio } from "@/server/services/catalogo"
import { servicioBody } from "@/server/validators/catalogo"
import { idParams, parseBody, parseParams } from "@/server/validators/common"

type Params = { id: string }

// GET - Obtener servicio
export const GET = withAuth<Params>(
  { permission: { module: "servicios", action: "read" }, error: "Error al obtener servicio" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    return NextResponse.json({ servicio: await obtenerServicio(id) })
  },
)

// PUT - Actualizar servicio
export const PUT = withAuth<Params>(
  { permission: { module: "servicios", action: "update" }, error: "Error al actualizar servicio" },
  async (request, { params }) => {
    const { id } = await parseParams(params, idParams)
    const datos = await parseBody(request, servicioBody)
    const servicio = await actualizarServicio(id, datos)
    revalidarCatalogo()
    return NextResponse.json({ servicio })
  },
)

// DELETE - Eliminar servicio (solo si nunca se usó en pedidos)
export const DELETE = withAuth<Params>(
  { permission: { module: "servicios", action: "delete" }, error: "Error al eliminar servicio" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    await eliminarServicio(id)
    revalidarCatalogo()
    return NextResponse.json({ success: true })
  },
)
