import "server-only"

import { cookies } from "next/headers"
import { ADMIN_SESSION_SECONDS, PORTAL_SESSION_SECONDS } from "@/lib/jwt"

// Cookies de sesión del panel admin y del portal. httpOnly, sameSite=lax y
// secure en producción; el maxAge coincide con la expiración del JWT.

export const ADMIN_COOKIE = "auth-token"
export const PORTAL_COOKIE = "portal-auth-token"

async function setSessionCookie(name: string, token: string, maxAge: number) {
  const cookieStore = await cookies()
  cookieStore.set(name, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
  })
}

export async function setAdminSessionCookie(token: string) {
  await setSessionCookie(ADMIN_COOKIE, token, ADMIN_SESSION_SECONDS)
}

export async function setPortalSessionCookie(token: string) {
  await setSessionCookie(PORTAL_COOKIE, token, PORTAL_SESSION_SECONDS)
}

export async function clearAdminSessionCookie() {
  ;(await cookies()).delete(ADMIN_COOKIE)
}

export async function clearPortalSessionCookie() {
  ;(await cookies()).delete(PORTAL_COOKIE)
}
