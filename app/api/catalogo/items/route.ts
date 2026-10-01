import { NextResponse } from "next/server"
import { withErrors } from "@/server/auth/guard"
import { itemsDelCatalogo } from "@/server/services/catalogo"
import { catalogoPublicoQuery } from "@/server/validators/catalogo"
import { parseQuery } from "@/server/validators/common"

// GET - Productos y servicios activos para el catálogo público
export const GET = withErrors({ error: "Error al obtener items del catálogo" }, async (request) => {
  const { search } = parseQuery(request, catalogoPublicoQuery)
  const { productos, servicios } = await itemsDelCatalogo(search)
  return NextResponse.json({ productos, servicios, total: productos.length + servicios.length })
})
