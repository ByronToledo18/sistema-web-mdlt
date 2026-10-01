import { redirect } from "next/navigation"
import { CambiarPasswordForm } from "@/components/admin/cambiar-password-form"
import { getSessionUser } from "@/server/auth/session"

// Fuera de /admin a propósito: requireUser (layout del admin) manda aquí a
// quien tenga debe_cambiar_password, y esta página no puede exigir lo mismo.
export default async function CambiarPasswordPage() {
  const user = await getSessionUser()
  if (!user) redirect("/login")

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-pink-100 p-4">
      <CambiarPasswordForm nombre={user.nombre} obligatorio={!!user.debe_cambiar_password} />
    </div>
  )
}
