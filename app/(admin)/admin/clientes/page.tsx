import { BackButton } from "@/components/ui/back-button"
import { ClientesGrid, NuevoClienteButton } from "@/components/admin/clientes/clientes-grid"
import { ListFilters } from "@/components/admin/list-filters"
import { can } from "@/server/auth/guard"
import { requirePermission } from "@/server/auth/session"
import { listarClientes } from "@/server/services/clientes"

type SearchParams = Promise<{ q?: string; inactivos?: string }>

export default async function ClientesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("clientes")
  const { q, inactivos } = await searchParams
  const clientes = await listarClientes({ search: q?.trim() || undefined, mostrarInactivos: inactivos === "1" })

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/dashboard" />
            <div>
              <h1 className="text-3xl font-bold">Clientes</h1>
              <p className="text-muted-foreground">Gestión de clientes del negocio</p>
            </div>
          </div>
          {can(user, "clientes", "create") && <NuevoClienteButton />}
        </div>

        <ListFilters
          placeholder="Buscar por nombre, email o teléfono..."
          toggle={{ id: "mostrar-inactivos", param: "inactivos", label: "Mostrar inactivos" }}
        />

        <ClientesGrid
          clientes={clientes}
          canEdit={can(user, "clientes", "update")}
          canToggleStatus={can(user, "clientes", "delete")}
        />
      </div>
    </div>
  )
}
