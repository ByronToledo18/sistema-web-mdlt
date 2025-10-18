import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { jwtVerify } from "jose"
import { cookies } from "next/headers"

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "your-secret-key-change-in-production")

async function getClienteFromToken() {
  const cookieStore = await cookies()
  const token = cookieStore.get("portal-auth-token")

  if (!token) {
    return null
  }

  try {
    const verified = await jwtVerify(token.value, JWT_SECRET)
    return verified.payload.cliente as { id: number; email: string; nombre: string }
  } catch (error) {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const clienteToken = await getClienteFromToken()

    if (!clienteToken) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const result = await sql`
      SELECT id, nombre, cedula, email, telefono, direccion, activo
      FROM clientes
      WHERE id = ${clienteToken.id}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 })
    }

    return NextResponse.json({ cliente: result[0] })
  } catch (error: any) {
    console.error("[v0] Get cliente error:", error)
    return NextResponse.json({ error: error.message || "Error al obtener cliente" }, { status: 500 })
  }
}
