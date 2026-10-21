import { NextResponse } from "next/server"
import { withAuth } from "@/server/auth/guard"
import { descargarGuia } from "@/server/services/servientrega"
import { idParams, parseParams, parseQuery } from "@/server/validators/common"
import { tipoDocumentoGuia } from "@/server/validators/servientrega"

// GET ?tipo=a4|rotulo → PDF de la guía de Servientrega del envío.
export const GET = withAuth<{ id: string }>(
  { permission: { module: "envios", action: "read" }, error: "Error al descargar la guía de Servientrega" },
  async (request, { params }) => {
    const { id } = await parseParams(params, idParams)
    const { tipo } = parseQuery(request, tipoDocumentoGuia)
    const { numero, pdf } = await descargarGuia(id, tipo)
    const nombre = `${tipo === "a4" ? "guia" : "rotulo"}-servientrega-${numero.replace(/\D/g, "")}.pdf`
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombre}"`,
        "Cache-Control": "no-store",
      },
    })
  },
)
