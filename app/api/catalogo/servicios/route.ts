import { NextResponse } from "next/server"
import { withErrors } from "@/server/auth/guard"
import { serviciosDelCatalogo } from "@/server/services/catalogo"
import { catalogoPublicoQuery } from "@/server/validators/catalogo"
import { parseQuery } from "@/server/validators/common"

// GET - Servicios activos del catálogo público
export const GET = withErrors({ error: "Error al obtener servicios" }, async (request) => {
  const { search } = parseQuery(request, catalogoPublicoQuery)
  return NextResponse.json(await serviciosDelCatalogo({ search }))
})
