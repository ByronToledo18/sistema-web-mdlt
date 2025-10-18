import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { createAuditLog } from "@/lib/audit"
import { verifyToken } from "@/lib/auth"
import type { NextRequest } from "next/server"

export async function GET() {
  return NextResponse.json({ error: "Method not allowed. Use POST to logout." }, { status: 405 })
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get("auth-token")?.value
    let userId: number | undefined

    if (token) {
      const user = await verifyToken(token)
      if (user) {
        userId = user.id

        await createAuditLog({
          usuario_id: userId,
          accion: "logout",
          modulo: "auth",
          descripcion: `Logout: ${user.email}`,
          ip_address: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined,
          user_agent: request.headers.get("user-agent") || undefined,
        })
      }
    }

    const cookieStore = await cookies()
    cookieStore.delete("auth-token")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Logout error:", error)
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 })
  }
}
