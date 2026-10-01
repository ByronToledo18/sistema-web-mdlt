import Link from "next/link"
import { Eye } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/components/admin/format"
import { ListFilters } from "@/components/admin/list-filters"
import { estadoColors, estadoLabels } from "@/components/admin/pedidos/estado"
import { NuevoPedidoDialog } from "@/components/admin/pedidos/nuevo-pedido-dialog"
import { Paginacion } from "@/components/admin/paginacion"
import { UrlSelectFilter } from "@/components/admin/url-select-filter"
import { can } from "@/server/auth/guard"
import { requirePermission } from "@/server/auth/session"
import { listarClientes } from "@/server/services/clientes"
import { paginaDePedidos } from "@/server/services/pedidos"
import { numeroDePagina } from "@/server/validators/common"

const ESTADO_OPTIONS = [
  { value: "todos", label: "Todos los estados" },
  ...Object.entries(estadoLabels).map(([value, label]) => ({ value, label })),
]

type SearchParams = Promise<{ q?: string; estado?: string; page?: string }>

export default async function PedidosPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("pedidos")
  const { q, estado, page } = await searchParams
  const canCreate = can(user, "pedidos", "create")

  const [{ filas: pedidos, pagina, haySiguiente }, clientes] = await Promise.all([
    paginaDePedidos({ search: q?.trim() || undefined, estado }, numeroDePagina(page)),
    canCreate ? listarClientes({ mostrarInactivos: false }) : [],
  ])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/dashboard" />
            <div>
              <h1 className="text-3xl font-bold">Pedidos</h1>
              <p className="text-muted-foreground">Gestión y seguimiento de pedidos</p>
            </div>
          </div>

          {canCreate && (
            <div className="flex items-center gap-2">
              <NuevoPedidoDialog clientes={clientes.map((c) => ({ id: c.id, nombre: c.nombre }))} />
            </div>
          )}
        </div>

        <ListFilters placeholder="Buscar por código o cliente..." className="flex flex-col sm:flex-row gap-4">
          <UrlSelectFilter param="estado" allValue="todos" options={ESTADO_OPTIONS} className="w-full sm:w-[200px]" />
        </ListFilters>

        {pedidos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No se encontraron pedidos</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pedidos.map((pedido) => (
              <Card key={pedido.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{pedido.codigo}</CardTitle>
                      <CardDescription>
                        {pedido.cliente_nombre}
                        {pedido.cliente_telefono && ` • ${pedido.cliente_telefono}`}
                      </CardDescription>
                    </div>
                    <Badge className={estadoColors[pedido.estado ?? ""]}>{estadoLabels[pedido.estado ?? ""]}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">{formatCurrency(pedido.total)}</p>
                      <p className="text-sm text-muted-foreground">Creado: {formatDate(pedido.fecha_creacion, "short")}</p>
                    </div>
                    <Button variant="outline" asChild>
                      <Link href={`/admin/pedidos/${pedido.id}`}>
                        <Eye className="mr-2 h-4 w-4" />
                        Ver Detalle
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Paginacion pagina={pagina} haySiguiente={haySiguiente} />
      </div>
    </div>
  )
}
