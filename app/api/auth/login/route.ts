import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { generateToken, verifyPassword } from "@/lib/auth"
import { cookies } from "next/headers"
import { createAuditLog } from "@/lib/audit"

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 })
    }

    // Buscar usuario con su rol
    const users = await sql<{
      id: number
      email: string
      nombre: string
      hash_password: string
      activo: boolean
      rol_id: number
      rol_nombre: string
    }>`
      SELECT u.id, u.email, u.nombre, u.hash_password, u.activo, u.rol_id, r.nombre as rol_nombre
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE u.email = ${email}
    `

    const user = users[0]

    if (!user) {
      await createAuditLog({
        accion: "login_fallido",
        modulo: "auth",
        descripcion: `Intento de login fallido para email: ${email}`,
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
        user_agent: request.headers.get("user-agent") || undefined,
      })
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })
    }

    if (!user.activo) {
      await createAuditLog({
        usuario_id: user.id,
        accion: "login_usuario_inactivo",
        modulo: "auth",
        descripcion: `Intento de login de usuario inactivo: ${user.email}`,
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
        user_agent: request.headers.get("user-agent") || undefined,
      })
      return NextResponse.json({ error: "Usuario inactivo" }, { status: 403 })
    }

    // Verificar contraseña
    const isValid = await verifyPassword(password, user.hash_password)

    if (!isValid) {
      await createAuditLog({
        usuario_id: user.id,
        accion: "login_password_incorrecto",
        modulo: "auth",
        descripcion: `Contraseña incorrecta para usuario: ${user.email}`,
        ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
        user_agent: request.headers.get("user-agent") || undefined,
      })
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 })
    }

    // Generar token
    const token = await generateToken({
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol_nombre,
      rol_id: user.rol_id,
    })

    // Establecer cookie
    const cookieStore = await cookies()
    cookieStore.set("auth-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 horas
      path: "/",
    })

    await createAuditLog({
      usuario_id: user.id,
      accion: "login_exitoso",
      modulo: "auth",
      descripcion: `Login exitoso: ${user.email}`,
      ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
      user_agent: request.headers.get("user-agent") || undefined,
      metadata: { rol: user.rol_nombre },
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol_nombre,
      },
    })
  } catch (error) {
    console.error("[v0] Login error:", error)
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 })
  }
}
