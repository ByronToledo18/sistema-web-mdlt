import { PerfilForm } from "@/components/portal/perfil-form"
import { requireCliente } from "@/server/auth/session"
import { obtenerPerfilCliente } from "@/server/services/clientes"

export default async function PerfilPage() {
  const sesion = await requireCliente()
  const cliente = await obtenerPerfilCliente(sesion.id)
  return <PerfilForm cliente={cliente} />
}
