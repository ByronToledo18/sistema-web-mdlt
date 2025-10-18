import { NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function POST() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete("portal-auth-token")

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Logout error:", error)
    return NextResponse.json({ error: error.message || "Error al cerrar sesión" }, { status: 500 })
  }
}
