import { NextResponse } from "next/server"
import { withErrors } from "@/server/auth/guard"
import { envioGrabaIva, tarifasDeEnvio } from "@/server/services/catalogo"

// GET - Tarifas de envío activas (público, lo usa el checkout)
export const GET = withErrors({ error: "Error al obtener tarifas" }, async () => {
  const [tarifas, envio_graba_iva] = await Promise.all([tarifasDeEnvio(), envioGrabaIva()])
  return NextResponse.json({ tarifas, envio_graba_iva })
})
