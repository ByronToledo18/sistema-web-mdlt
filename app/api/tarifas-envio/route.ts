import { NextResponse } from "next/server"
import { withErrors } from "@/server/auth/guard"
import { tarifasDeEnvio } from "@/server/services/catalogo"

// GET - Tarifas de envío activas (público, lo usa el checkout)
export const GET = withErrors({ error: "Error al obtener tarifas" }, async () => {
  return NextResponse.json({ tarifas: await tarifasDeEnvio() })
})
