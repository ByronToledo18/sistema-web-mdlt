"use client"

import { Bar, BarChart, Cell, XAxis, YAxis } from "recharts"
import { estadoLabels } from "@/components/admin/pedidos/estado"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { EstadoPedido } from "@/server/services/dashboard"

const chartConfig = {
  recibido: { label: estadoLabels.recibido, color: "var(--chart-2)" },
  en_proceso: { label: estadoLabels.en_proceso, color: "var(--chart-1)" },
  terminado: { label: estadoLabels.terminado, color: "var(--chart-5)" },
  entregado: { label: estadoLabels.entregado, color: "var(--chart-3)" },
  anulado: { label: estadoLabels.anulado, color: "var(--chart-4)" },
} satisfies ChartConfig

export function PedidosPorEstadoChart({ data }: { data: { estado: EstadoPedido; cantidad: number }[] }) {
  if (data.every((d) => d.cantidad === 0)) {
    return <p className="py-16 text-center text-sm text-neutral-600">Aún no hay pedidos</p>
  }

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }} accessibilityLayer>
        <YAxis
          dataKey="estado"
          type="category"
          tickLine={false}
          axisLine={false}
          width={88}
          tickFormatter={(estado: EstadoPedido) => estadoLabels[estado] ?? estado}
        />
        <XAxis type="number" dataKey="cantidad" allowDecimals={false} hide />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="estado" />} />
        <Bar dataKey="cantidad" radius={4}>
          {data.map((d) => (
            <Cell key={d.estado} fill={`var(--color-${d.estado})`} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}
