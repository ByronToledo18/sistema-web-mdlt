import { type NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth"
import { registrarMovimiento, getMovimientos, getConsolidadoPorPersona } from "@/lib/nomina"
import { createAuditLog } from "@/lib/audit"

// GET - Listar movimientos de nómina (con filtros) o consolidado por persona
export async function GET(request: NextRequest) {
  try {
    await requireAuth(["administrador"])

    const { searchParams } = new URL(request.url)
    const vista = searchParams.get("vista")

    if (vista === "consolidado") {
      const consolidado = await getConsolidadoPorPersona(
        searchParams.get("fecha_desde") || undefined,
        searchParams.get("fecha_hasta") || undefined,
      )
      return NextResponse.json({ consolidado })
    }

    const movimientos = await getMovimientos({
      persona_tipo: searchParams.get("persona_tipo") || undefined,
      tipo: searchParams.get("tipo") || undefined,
      fecha_desde: searchParams.get("fecha_desde") || undefined,
      fecha_hasta: searchParams.get("fecha_hasta") || undefined,
    })

    return NextResponse.json({ movimientos })
  } catch (error: any) {
    console.error("[v0] Get nomina error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener movimientos de nómina" }, { status: 500 })
  }
}

// POST - Registrar movimiento de nómina
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(["administrador"])

    const { persona_tipo, concepto, monto, fecha, tipo, pedido_id } = await request.json()

    if (!persona_tipo || !concepto || !fecha || !tipo) {
      return NextResponse.json(
        { error: "Persona, concepto, fecha y tipo son requeridos" },
        { status: 400 },
      )
    }

    if (!["pago", "deduccion", "bono"].includes(tipo)) {
      return NextResponse.json({ error: "Tipo inválido" }, { status: 400 })
    }

    const montoNum = Number.parseFloat(monto)
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      return NextResponse.json({ error: "El monto debe ser mayor a 0" }, { status: 400 })
    }

    const movimiento = await registrarMovimiento({
      persona_tipo,
      concepto,
      monto: montoNum,
      fecha,
      tipo,
      pedido_id: pedido_id || null,
    })

    await createAuditLog({
      usuario_id: user.id,
      accion: "crear",
      modulo: "nomina",
      descripcion: `Registró movimiento de nómina (${tipo}) por $${montoNum} - ${concepto}`,
    })

    return NextResponse.json({ movimiento }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Create nomina error:", error)
    return NextResponse.json({ error: error.message || "Error al registrar movimiento" }, { status: 500 })
  }
}
