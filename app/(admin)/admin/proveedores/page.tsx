import { BackButton } from "@/components/ui/back-button"
import { ListFilters } from "@/components/admin/list-filters"
import { Paginacion } from "@/components/admin/paginacion"
import { NuevoProveedorButton, ProveedoresGrid } from "@/components/admin/proveedores/proveedores-grid"
import { can } from "@/server/auth/guard"
import { requirePermission } from "@/server/auth/session"
import { paginaDeProveedores } from "@/server/services/proveedores"
import { numeroDePagina } from "@/server/validators/common"

type SearchParams = Promise<{ q?: string; inactivos?: string; page?: string }>

export default async function ProveedoresPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("proveedores")
  const { q, inactivos, page } = await searchParams
  const { filas: proveedores, pagina, haySiguiente } = await paginaDeProveedores(
    { search: q?.trim() || undefined, mostrarInactivos: inactivos === "1" },
    numeroDePagina(page),
  )

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/dashboard" />
            <div>
              <h1 className="text-3xl font-bold">Proveedores</h1>
              <p className="text-muted-foreground">Gestión de proveedores y facturas</p>
            </div>
          </div>
          {can(user, "proveedores", "create") && <NuevoProveedorButton />}
        </div>

        <ListFilters
          placeholder="Buscar por nombre, RUC o email..."
          toggle={{ id: "mostrar-inactivos", param: "inactivos", label: "Mostrar inactivos" }}
        />

        <ProveedoresGrid proveedores={proveedores} canUpdate={can(user, "proveedores", "update")} />

        <Paginacion pagina={pagina} haySiguiente={haySiguiente} />
      </div>
    </div>
  )
}
