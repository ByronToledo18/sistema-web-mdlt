import { NextResponse } from "next/server"
import { revalidarCatalogo } from "@/lib/catalogo-cache"
import { withAuth } from "@/server/auth/guard"
import { actualizarProducto, eliminarProducto, obtenerProducto } from "@/server/services/catalogo"
import { productoBody } from "@/server/validators/catalogo"
import { idParams, parseBody, parseParams } from "@/server/validators/common"

type Params = { id: string }

// GET - Obtener producto
export const GET = withAuth<Params>(
  { permission: { module: "productos", action: "read" }, error: "Error al obtener producto" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    return NextResponse.json({ producto: await obtenerProducto(id) })
  },
)

// PUT - Actualizar producto
export const PUT = withAuth<Params>(
  { permission: { module: "productos", action: "update" }, error: "Error al actualizar producto" },
  async (request, { params }) => {
    const { id } = await parseParams(params, idParams)
    const datos = await parseBody(request, productoBody)
    const producto = await actualizarProducto(id, datos)
    revalidarCatalogo()
    return NextResponse.json({ producto })
  },
)

// DELETE - Eliminar producto (solo si nunca se usó en pedidos)
export const DELETE = withAuth<Params>(
  { permission: { module: "productos", action: "delete" }, error: "Error al eliminar producto" },
  async (_request, { params }) => {
    const { id } = await parseParams(params, idParams)
    await eliminarProducto(id)
    revalidarCatalogo()
    return NextResponse.json({ success: true })
  },
)
