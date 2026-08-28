import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { verifyPassword, JWT_SECRET } from "@/lib/auth"
import { SignJWT } from "jose"
import { cookies } from "next/headers"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 })
    }

    // Buscar cliente
    const result = await sql`
      SELECT id, nombre, email, hash_password, activo
      FROM clientes
      WHERE email = ${email}
    `

    if (result.length === 0) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })
    }

    const cliente = result[0]

    // Verificar si el cliente está activo
    if (!cliente.activo) {
      return NextResponse.json({ error: "Tu cuenta está desactivada. Contacta al soporte." }, { status: 403 })
    }

    // Verificar si tiene contraseña configurada
    if (!cliente.hash_password) {
      return NextResponse.json(
        { error: "Tu cuenta no tiene contraseña configurada. Contacta al administrador." },
        { status: 403 },
      )
    }

    // Verificar contraseña
    const isValid = await verifyPassword(password, cliente.hash_password)

    if (!isValid) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })
    }

    // Actualizar último acceso
    await sql`UPDATE clientes SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = ${cliente.id}`

    // Generar token JWT
    const token = await new SignJWT({ cliente: { id: cliente.id, email: cliente.email, nombre: cliente.nombre } })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(JWT_SECRET)

    // Establecer cookie
    const cookieStore = await cookies()
    cookieStore.set("portal-auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: "/",
    })

    return NextResponse.json({
      cliente: {
        id: cliente.id,
        nombre: cliente.nombre,
        email: cliente.email,
      },
    })
  } catch (error: any) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: error.message || "Error al iniciar sesión" }, { status: 500 })
  }
}
