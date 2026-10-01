import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyToken } from "@/lib/jwt"
import { canAccessRoute } from "@/lib/permissions"

const protectedRoutes = ["/admin"]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get("auth-token")?.value

  // Verificar si la ruta está protegida
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route))

  // Si es una ruta protegida y no hay token, redirigir a login
  if (isProtectedRoute && !token) {
    const url = new URL("/login", request.url)
    url.searchParams.set("redirect", pathname)
    return NextResponse.redirect(url)
  }

  // Si hay token, verificarlo
  if (token) {
    const user = await verifyToken(token)

    // Si el token es inválido, eliminar cookie y redirigir a login
    if (!user && isProtectedRoute) {
      const response = NextResponse.redirect(new URL("/login", request.url))
      response.cookies.delete("auth-token")
      return response
    }

    if (user && isProtectedRoute) {
      // Permisos por página: ROUTE_MODULES en lib/permissions.ts
      if (!canAccessRoute(user.rol, pathname)) {
        // Redirigir a dashboard si no tiene acceso
        return NextResponse.redirect(new URL("/admin/dashboard", request.url))
      }
    }

    // Si está autenticado y trata de acceder a login, redirigir a dashboard
    if (user && pathname === "/login") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*|_next).*)"],
}
