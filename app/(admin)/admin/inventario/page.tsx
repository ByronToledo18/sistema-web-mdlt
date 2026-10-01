import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BackButton } from "@/components/ui/back-button"
import { InventarioFiltros } from "@/components/admin/inventario/inventario-filtros"
import { InventarioTabs } from "@/components/admin/inventario/inventario-tabs"
import { can } from "@/server/auth/guard"
import { requirePermission } from "@/server/auth/session"
import { listarProductos, listarServicios } from "@/server/services/catalogo"

type SearchParams = Promise<{ q?: string; inactivos?: string }>

export default async function InventarioPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("productos")
  const canManage = can(user, "productos", "create")
  const { q, inactivos } = await searchParams

  const search = q?.trim() || undefined
  // Solo quien gestiona el inventario puede ver los inactivos.
  const activo = canManage && inactivos === "1" ? undefined : true

  const [productos, servicios] = await Promise.all([
    listarProductos({ search, activo }),
    listarServicios({ search, activo }),
  ])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/dashboard" />
            <div>
              <h1 className="text-3xl font-bold">Inventario</h1>
              <p className="text-muted-foreground">
                {canManage ? "Gestión de productos y servicios" : "Consulta de productos y servicios"}
              </p>
            </div>
          </div>
        </div>

        {!canManage && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Estás en modo de solo lectura. Para solicitar reposición de productos o servicios, contacta al
              administrador.
            </AlertDescription>
          </Alert>
        )}

        <InventarioFiltros canManage={canManage} />

        <InventarioTabs productos={productos} servicios={servicios} canManage={canManage} />
      </div>
    </div>
  )
}
