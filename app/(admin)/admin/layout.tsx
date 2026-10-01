import type React from "react"
import { requireUser } from "@/server/auth/session"

// Todo /admin exige sesión. El middleware ya redirige sin cookie; esto cubre
// un token vencido o revocado. Las páginas leen el mismo usuario con
// getSessionUser()/requirePermission() sin volver a verificar el token.
export default async function AdminRootLayout({ children }: { children: React.ReactNode }) {
  await requireUser()
  return children
}
