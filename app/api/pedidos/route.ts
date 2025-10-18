import { type NextRequest, NextResponse } from "next/server"
import { sql, executeQuery } from "@/lib/db"
import { requireAuth } from "@/lib/auth"
import { generatePedidoCodigo } from "@/lib/pedidos"

// GET - Listar pedidos con filtros
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get("estado")
    const clienteId = searchParams.get("cliente_id")
    const search = searchParams.get("search")

    let queryText = `
      SELECT p.*, c.nombre as cliente_nombre, c.telefono as cliente_telefono
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      WHERE 1=1
    `
    const params: any[] = []
    let paramIndex = 1

    if (estado) {
      queryText += ` AND p.estado = $${paramIndex}`
      params.push(estado)
      paramIndex++
    }

    if (clienteId) {
      queryText += ` AND p.cliente_id = $${paramIndex}`
      params.push(clienteId)
      paramIndex++
    }

    if (search) {
      queryText += ` AND (p.codigo ILIKE $${paramIndex} OR c.nombre ILIKE $${paramIndex})`
      params.push(`%${search}%`)
      paramIndex++
    }

    queryText += ` ORDER BY p.created_at DESC`

    const pedidos = await executeQuery(queryText, params)

    return NextResponse.json({ pedidos })
  } catch (error: any) {
    console.error("[v0] Get pedidos error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener pedidos" }, { status: 500 })
  }
}

// POST - Crear nuevo pedido
export async function POST(request: NextRequest) {
  try {
    await requireAuth(["administrador", "asistente"])

    const { cliente_id } = await request.json()

    if (!cliente_id) {
      return NextResponse.json({ error: "El cliente es requerido" }, { status: 400 })
    }

    // Generar código único
    const codigo = await generatePedidoCodigo()

    const result = await sql`
      INSERT INTO pedidos (codigo, cliente_id, estado, total)
      VALUES (${codigo}, ${cliente_id}, 'recibido', 0)
      RETURNING *
    `

    return NextResponse.json({ pedido: result[0] }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Create pedido error:", error)
    return NextResponse.json({ error: error.message || "Error al crear pedido" }, { status: 500 })
  }
}
