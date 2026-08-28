import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { verifyToken } from "@/lib/auth"

const protectedRoutes = ["/admin"]

const publicRoutes = ["/", "/catalogo", "/login"]

const roleRoutes: Record<string, string[]> = {
  administrador: [
    "/admin/dashboard",
    "/admin/pedidos",
    "/admin/clientes",
    "/admin/inventario",
    "/admin/pagos",
    "/admin/envios",
    "/admin/proveedores",
    "/admin/nomina",
  ],
  asistente: ["/admin/dashboard", "/admin/pedidos", "/admin/clientes", "/admin/inventario", "/admin/envios"],
  soporte: ["/admin/dashboard", "/admin/soporte"],
}

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
      const userRole = user.rol as string
      const allowedRoutes = roleRoutes[userRole] || []

      // Verificar si el usuario tiene acceso a esta ruta
      const hasAccess = allowedRoutes.some((route) => pathname.startsWith(route))

      if (!hasAccess) {
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
