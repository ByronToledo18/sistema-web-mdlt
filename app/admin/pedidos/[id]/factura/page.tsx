"use client"

import { useState, useEffect, use } from "react"
import { Button } from "@/components/ui/button"
import { BackButton } from "@/components/ui/back-button"
import { Printer } from "lucide-react"

interface FacturaData {
  id: number
  numero_factura: string
  fecha_emision: string
  subtotal: string
  iva: string
  total: string
  pedido_codigo: string
  cliente_nombre: string
  cliente_cedula: string | null
}

interface PedidoItem {
  id: number
  descripcion: string
  cantidad: number
  precio_unitario: string
  subtotal: string
}

export default function FacturaPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = use(paramsPromise)
  const [factura, setFactura] = useState<FacturaData | null>(null)
  const [items, setItems] = useState<PedidoItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [params.id])

  const fetchData = async () => {
    try {
      const [facturaRes, pedidoRes] = await Promise.all([
        fetch(`/api/pedidos/${params.id}/factura`),
        fetch(`/api/pedidos/${params.id}`),
      ])
      const facturaData = await facturaRes.json()
      const pedidoData = await pedidoRes.json()

      if (facturaRes.ok) setFactura(facturaData.factura)
      if (pedidoRes.ok) setItems(pedidoData.pedido.items)
    } catch (err) {
      console.error("[v0] Error fetching factura data:", err)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: string | number) => {
    return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(
      typeof value === "string" ? Number.parseFloat(value) : value,
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-EC", { year: "numeric", month: "long", day: "numeric" })
  }

  if (loading) {
    return <div className="p-6 text-center">Cargando factura...</div>
  }

  if (!factura) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Este pedido todavía no tiene factura generada.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <BackButton href={`/admin/pedidos/${params.id}`} label="Volver al Pedido" />
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir
          </Button>
        </div>

        <div className="bg-white text-black rounded-lg border p-8 space-y-6 print:border-none print:shadow-none">
          <div className="flex items-start justify-between border-b pb-4">
            <div>
              <h1 className="text-2xl font-bold">El Mundo de las Tutus</h1>
              <p className="text-sm text-gray-600">Comprobante de venta</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">{factura.numero_factura}</p>
              <p className="text-sm text-gray-600">{formatDate(factura.fecha_emision)}</p>
              <p className="text-sm text-gray-600">Pedido {factura.pedido_codigo}</p>
            </div>
          </div>

          <div>
            <p className="text-sm text-gray-600">Cliente</p>
            <p className="font-medium">{factura.cliente_nombre}</p>
            {factura.cliente_cedula && <p className="text-sm text-gray-600">Cédula: {factura.cliente_cedula}</p>}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="py-2">Descripción</th>
                <th className="py-2 text-right">Cant.</th>
                <th className="py-2 text-right">P. Unitario</th>
                <th className="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="py-2">{item.descripcion}</td>
                  <td className="py-2 text-right">{item.cantidad}</td>
                  <td className="py-2 text-right">{formatCurrency(item.precio_unitario)}</td>
                  <td className="py-2 text-right">{formatCurrency(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-56 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal</span>
                <span>{formatCurrency(factura.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">IVA (15%)</span>
                <span>{formatCurrency(factura.iva)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t pt-1">
                <span>Total</span>
                <span>{formatCurrency(factura.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
