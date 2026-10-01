import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { apiError } from "@/lib/http"
import { logger } from "@/lib/logger"

export async function POST() {
  try {
    const cookieStore = await cookies()
    cookieStore.delete("portal-auth-token")

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error("api/portal/logout POST", error)
    return apiError(error, "Error al cerrar sesión")
  }
}
