import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error("[v0] Get current user error:", error)
    return NextResponse.json({ error: "Error en el servidor" }, { status: 500 })
  }
}
