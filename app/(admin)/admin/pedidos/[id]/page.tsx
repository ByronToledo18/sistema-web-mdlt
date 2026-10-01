import { notFound } from "next/navigation"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDateTime } from "@/components/admin/format"
import { PedidoEnviosCard } from "@/components/admin/pedidos/pedido-envios-card"
import { estadoColors, estadoLabels } from "@/components/admin/pedidos/estado"
import { PedidoEstadoSelect } from "@/components/admin/pedidos/pedido-estado-select"
import { PedidoFacturaButton } from "@/components/admin/pedidos/pedido-factura-button"
import { PedidoItemsCard } from "@/components/admin/pedidos/pedido-items-card"
import { PedidoPagosCard } from "@/components/admin/pedidos/pedido-pagos-card"
import { HttpError } from "@/lib/http"
import { can } from "@/server/auth/guard"
import { requirePermission } from "@/server/auth/session"
import { toCents } from "@/server/services/_shared"
import { listarProductos, listarServicios } from "@/server/services/catalogo"
import { listarEnvios } from "@/server/services/envios"
import { listarPagos } from "@/server/services/pagos"
import { obtenerFactura, obtenerPedido } from "@/server/services/pedidos"
import { idParams } from "@/server/validators/common"

async function cargarPedido(id: number) {
  try {
    return await obtenerPedido(id)
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound()
    throw error
  }
}

export default async function PedidoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("pedidos")
  const parsed = idParams.safeParse(await params)
  if (!parsed.success) notFound()
  const { id } = parsed.data

  const [pedido, pagos, envios, factura, productos, servicios] = await Promise.all([
    cargarPedido(id),
    listarPagos(id),
    listarEnvios(id),
    obtenerFactura(id),
    listarProductos({ activo: true }),
    listarServicios({ activo: true }),
  ])

  const pagadoCents = pagos.reduce((acc, pago) => acc + toCents(pago.monto), 0)
  const totalPagado = pagadoCents / 100
  const saldoPendiente = (toCents(pedido.total) - pagadoCents) / 100

  const estado = pedido.estado ?? "recibido"
  const isOrderClosed = estado === "terminado" || estado === "anulado" || estado === "entregado"
  const canEditClosed = can(user, "pedidos_cerrados", "update")
  // Estado y cobros: el administrador también en pedidos cerrados. Ítems y
  // eliminación de cobros: nadie, hasta reabrir el pedido.
  const canModifyOrder = canEditClosed || !isOrderClosed

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <BackButton href="/admin/pedidos" label="Volver a Pedidos" />
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{pedido.codigo}</h1>
            <p className="text-muted-foreground">Detalle del pedido</p>
          </div>
          <Badge className={estadoColors[estado]} style={{ fontSize: "1rem", padding: "0.5rem 1rem" }}>
            {estadoLabels[estado]}
          </Badge>
          <PedidoFacturaButton pedidoId={pedido.id} factura={factura} />
        </div>

        {isOrderClosed && (
          <Alert>
            <AlertDescription>
              Este pedido está <strong>{estado}</strong>: sus ítems y cobros no se pueden modificar.
              {canEditClosed
                ? " Para corregirlo, primero reábrelo cambiando su estado."
                : " Solo un administrador puede reabrirlo."}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Información del Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Nombre</p>
                <p className="font-medium">{pedido.cliente_nombre}</p>
              </div>
              {pedido.cliente_cedula && (
                <div>
                  <p className="text-sm text-muted-foreground">Cédula</p>
                  <p className="font-medium">{pedido.cliente_cedula}</p>
                </div>
              )}
              {pedido.cliente_telefono && (
                <div>
                  <p className="text-sm text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{pedido.cliente_telefono}</p>
                </div>
              )}
              {pedido.cliente_email && (
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{pedido.cliente_email}</p>
                </div>
              )}
              {pedido.cliente_direccion && (
                <div>
                  <p className="text-sm text-muted-foreground">Dirección</p>
                  <p className="font-medium">{pedido.cliente_direccion}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Información del Pedido</CardTitle>
                </div>
                <PedidoEstadoSelect
                  pedidoId={pedido.id}
                  estado={estado}
                  saldoPendiente={saldoPendiente}
                  disabled={!canModifyOrder}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Fecha de Creación</p>
                <p className="font-medium">{formatDateTime(pedido.fecha_creacion)}</p>
              </div>

              <div className="pt-4 border-t space-y-2">
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">Total del Pedido (con IVA)</p>
                  <p className="text-2xl font-bold">{formatCurrency(pedido.total)}</p>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">Pagado</p>
                  <p className="text-lg font-medium text-green-600">{formatCurrency(totalPagado)}</p>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <p className="text-sm font-medium">Saldo Pendiente</p>
                  <p className={`text-xl font-bold ${saldoPendiente > 0 ? "text-orange-600" : "text-green-600"}`}>
                    {formatCurrency(saldoPendiente)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {pedido.notas && (
          <Alert>
            <AlertDescription>
              <p className="font-medium mb-1">Notas del Pedido:</p>
              <p className="whitespace-pre-wrap">{pedido.notas}</p>
            </AlertDescription>
          </Alert>
        )}

        <PedidoItemsCard
          pedidoId={pedido.id}
          items={pedido.items}
          productos={productos.map((p) => ({ id: p.id, nombre: p.nombre, precio: p.precio, stock: p.stock }))}
          servicios={servicios.map((s) => ({ id: s.id, nombre: s.nombre, precio_base: s.precio_base }))}
          isOrderClosed={isOrderClosed}
          canModifyOrder={!isOrderClosed}
        />

        <PedidoPagosCard
          pedidoId={pedido.id}
          pagos={pagos}
          saldoPendiente={saldoPendiente}
          canModifyOrder={canModifyOrder}
          canDeletePago={can(user, "pagos", "delete") && !isOrderClosed}
        />

        <PedidoEnviosCard envios={envios} canDeleteEnvio={can(user, "envios", "delete")} />
      </div>
    </div>
  )
}
