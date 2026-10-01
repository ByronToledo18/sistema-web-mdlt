import { NextResponse } from "next/server"
import { withErrors } from "@/server/auth/guard"
import { productosDelCatalogo } from "@/server/services/catalogo"
import { catalogoPublicoQuery } from "@/server/validators/catalogo"
import { parseQuery } from "@/server/validators/common"

// GET - Productos activos del catálogo público
export const GET = withErrors({ error: "Error al obtener productos" }, async (request) => {
  const filtros = parseQuery(request, catalogoPublicoQuery)
  return NextResponse.json(await productosDelCatalogo(filtros))
})
