import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { crearProducto, listarProductos } from "@/server/services/catalogo"
import { listarCatalogoQuery, productoBody } from "@/server/validators/catalogo"
import { parseBody, parseQuery } from "@/server/validators/common"

// GET - Listar productos
export const GET = withAuth(
  { permission: { module: "productos", action: "read" }, error: "Error al obtener productos" },
  async (request) => {
    const filtros = parseQuery(request, listarCatalogoQuery)
    return NextResponse.json({ productos: await listarProductos(filtros) })
  },
)

// POST - Crear producto
export const POST = withAuth(
  { permission: { module: "productos", action: "create" }, error: "Error al crear producto" },
  async (request) => {
    const datos = await parseBody(request, productoBody)
    return NextResponse.json({ producto: await crearProducto(datos) }, { status: 201 })
  },
)
