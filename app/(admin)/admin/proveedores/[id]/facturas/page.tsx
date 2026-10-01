import { notFound } from "next/navigation"
import { FileText } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/components/admin/format"
import { FacturaAcciones } from "@/components/admin/proveedores/factura-acciones"
import { NuevaFacturaDialog } from "@/components/admin/proveedores/nueva-factura-dialog"
import { UrlSelectFilter } from "@/components/admin/url-select-filter"
import { can } from "@/server/auth/guard"
import { requirePermission } from "@/server/auth/session"
import { listarProductos } from "@/server/services/catalogo"
import { listarFacturasProveedor } from "@/server/services/proveedores"
import { idParams } from "@/server/validators/common"

const estadoColors: Record<string, string> = {
  pendiente: "bg-yellow-500",
  pagada: "bg-green-500",
  vencida: "bg-red-500",
  anulada: "bg-gray-500",
}

const estadoLabels: Record<string, string> = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  vencida: "Vencida",
  anulada: "Anulada",
}

const ESTADO_OPTIONS = [
  { value: "todas", label: "Todas" },
  { value: "pendiente", label: "Pendientes" },
  { value: "pagada", label: "Pagadas" },
  { value: "vencida", label: "Vencidas" },
  { value: "anulada", label: "Anuladas" },
]

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ estado?: string }>
}

export default async function ProveedorFacturasPage({ params, searchParams }: PageProps) {
  const user = await requirePermission("proveedores")
  const parsed = idParams.safeParse(await params)
  if (!parsed.success) notFound()
  const proveedorId = parsed.data.id
  const { estado } = await searchParams

  const [facturas, productos] = await Promise.all([
    listarFacturasProveedor(proveedorId, estado),
    listarProductos({}),
  ])

  const canCreate = can(user, "proveedores", "create")
  const canPay = can(user, "proveedores", "update")

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/proveedores" />
            <div>
              <h1 className="text-3xl font-bold">Facturas de Proveedor</h1>
              <p className="text-muted-foreground">Gestión de facturas y pagos</p>
            </div>
          </div>

          {canCreate && (
            <NuevaFacturaDialog
              proveedorId={proveedorId}
              productos={productos.map((p) => ({ id: p.id, nombre: p.nombre, sku: p.sku }))}
            />
          )}
        </div>

        <div className="flex items-center gap-4">
          <UrlSelectFilter param="estado" allValue="todas" options={ESTADO_OPTIONS} className="w-[200px]" />
        </div>

        {facturas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No se encontraron facturas</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {facturas.map((factura) => (
              <Card key={factura.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-xl">{factura.numero_factura}</CardTitle>
                      </div>
                      <CardDescription>
                        Emisión: {formatDate(factura.fecha_emision, "short")}
                        {factura.fecha_vencimiento && ` • Vence: ${formatDate(factura.fecha_vencimiento, "short")}`}
                      </CardDescription>
                    </div>
                    <Badge className={estadoColors[factura.estado ?? ""]}>{estadoLabels[factura.estado ?? ""]}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>{formatCurrency(factura.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">IVA:</span>
                        <span>{formatCurrency(factura.iva)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-2">
                        <span>Total:</span>
                        <span>{formatCurrency(factura.total)}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Pagado:</span>
                        <span className="text-green-600 font-medium">{formatCurrency(factura.pagado)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t pt-2">
                        <span>Saldo:</span>
                        <span className="text-red-600">{formatCurrency(factura.saldo)}</span>
                      </div>
                    </div>
                  </div>

                  {canPay && factura.estado !== "anulada" && factura.estado !== "pagada" && (
                    <FacturaAcciones
                      factura={{ id: factura.id, numero_factura: factura.numero_factura, saldo: factura.saldo }}
                    />
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
