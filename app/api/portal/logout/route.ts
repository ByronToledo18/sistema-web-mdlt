import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { apiError } from "@/lib/http"

export async function POST() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete("portal-auth-token")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Logout error:", error)
    return apiError(error, "Error al cerrar sesión")
  }
}
