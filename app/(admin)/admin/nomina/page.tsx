import { DollarSign } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatDate } from "@/components/admin/format"
import { EliminarMovimientoButton } from "@/components/admin/nomina/eliminar-movimiento-button"
import { personaTipoLabels } from "@/components/admin/nomina/personas"
import { RegistrarMovimientoDialog } from "@/components/admin/nomina/registrar-movimiento-dialog"
import { UrlSelectFilter } from "@/components/admin/url-select-filter"
import { can } from "@/server/auth/guard"
import { requirePermission } from "@/server/auth/session"
import { consolidadoPorPersona, listarMovimientos } from "@/server/services/nomina"

const tipoColors: Record<string, string> = {
  pago: "bg-green-500",
  bono: "bg-blue-500",
  deduccion: "bg-red-500",
}

const PERSONA_OPTIONS = [
  { value: "todos", label: "Todas las personas" },
  ...Object.entries(personaTipoLabels).map(([value, label]) => ({ value, label })),
]

type SearchParams = Promise<{ persona?: string }>

export default async function NominaPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("nomina")
  const { persona } = await searchParams

  const [movimientos, consolidado] = await Promise.all([
    listarMovimientos({ persona_tipo: persona }),
    consolidadoPorPersona(),
  ])
  const canDelete = can(user, "nomina", "delete")

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BackButton href="/admin/dashboard" />
            <div>
              <h1 className="text-3xl font-bold">Nómina</h1>
              <p className="text-muted-foreground">Registro manual de pagos a personas</p>
            </div>
          </div>

          {can(user, "nomina", "create") && <RegistrarMovimientoDialog />}
        </div>

        {consolidado.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {consolidado.map((c) => (
              <Card key={c.persona_tipo}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {personaTipoLabels[c.persona_tipo] || c.persona_tipo}
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {formatCurrency(Number(c.total_pagado) - Number(c.total_deducido))}
                  </div>
                  <p className="text-xs text-muted-foreground">{c.movimientos} movimiento(s)</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Movimientos</CardTitle>
                <CardDescription>Historial de pagos, bonos y deducciones</CardDescription>
              </div>
              <div className="w-56">
                <UrlSelectFilter param="persona" allValue="todos" options={PERSONA_OPTIONS} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {movimientos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No hay movimientos registrados</div>
            ) : (
              <div className="space-y-2">
                {movimientos.map((mov) => (
                  <div key={mov.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={tipoColors[mov.tipo ?? ""]}>{mov.tipo}</Badge>
                        <Badge variant="outline">{personaTipoLabels[mov.persona_tipo] || mov.persona_tipo}</Badge>
                        {mov.pedido_codigo && <Badge variant="secondary">{mov.pedido_codigo}</Badge>}
                      </div>
                      <p className="text-sm">{mov.concepto}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(mov.fecha, "short")}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className={`font-bold text-lg ${mov.tipo === "deduccion" ? "text-red-600" : "text-green-600"}`}>
                        {mov.tipo === "deduccion" ? "-" : "+"}
                        {formatCurrency(mov.monto)}
                      </p>
                      {canDelete && <EliminarMovimientoButton id={mov.id} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
