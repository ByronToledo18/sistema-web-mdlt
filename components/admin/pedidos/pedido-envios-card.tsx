"use client"

import { useTransition } from "react"
import { Trash2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { eliminarEnvioAction } from "@/app/(admin)/admin/pedidos/actions"
import { formatCurrency, formatDateTime } from "@/components/admin/format"
import type { EnvioPedido } from "./types"

const estadoEnvioColors: Record<string, string> = {
  pendiente: "bg-yellow-500",
  en_proceso: "bg-blue-500",
  terminado: "bg-green-500",
}

const estadoEnvioLabels: Record<string, string> = {
  pendiente: "Pendiente",
  en_proceso: "En Proceso",
  terminado: "Terminado",
}

export function PedidoEnviosCard({ envios, canDeleteEnvio }: { envios: EnvioPedido[]; canDeleteEnvio: boolean }) {
  const [isPending, startTransition] = useTransition()

  const handleDeleteEnvio = (envioId: number) => {
    if (!confirm("¿Estás seguro de eliminar este envío?")) return
    startTransition(async () => {
      const result = await eliminarEnvioAction(envioId)
      if (!result.ok) alert(result.error)
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Envíos</CardTitle>
            <CardDescription>
              {envios.length === 0 ? "No hay envíos registrados" : `${envios.length} envío(s) registrado(s)`}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {envios.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No hay envíos registrados para este pedido.</p>
            <p className="text-sm mt-2">Agrega el servicio de "Envío" como item para registrar el costo de envío.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {envios.map((envio) => (
              <div key={envio.id} className="flex items-start justify-between p-4 border rounded-lg">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-bold text-lg">{envio.guia}</p>
                    <Badge className={estadoEnvioColors[envio.estado ?? ""]}>{estadoEnvioLabels[envio.estado ?? ""]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{formatDateTime(envio.fecha_envio)}</p>
                  <p className="text-sm">
                    <span className="font-medium">Costo:</span> {formatCurrency(envio.costo)}
                  </p>
                  {envio.estado === "terminado" && (
                    <Alert>
                      <AlertDescription className="text-xs">
                        Este envío ha sido agregado a la cuenta de Servientrega
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                {canDeleteEnvio && (
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={() => handleDeleteEnvio(envio.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
