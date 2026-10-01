"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { formatCurrency } from "@/components/admin/format"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import type { VentasMes } from "@/server/services/dashboard"

const chartConfig = {
  total: { label: "Ventas", color: "var(--chart-1)" },
} satisfies ChartConfig

const mesCorto = new Intl.DateTimeFormat("es-EC", { month: "short", timeZone: "UTC" })
const mesLargo = new Intl.DateTimeFormat("es-EC", { month: "long", year: "numeric", timeZone: "UTC" })

// "2026-09" → día 1 a mediodía UTC, para que ninguna zona cambie el mes.
function aFecha(mes: string) {
  return new Date(`${mes}-01T12:00:00Z`)
}

export function VentasPorMesChart({ data }: { data: VentasMes[] }) {
  if (data.every((d) => d.total === 0)) {
    return <p className="py-16 text-center text-sm text-neutral-600">Aún no hay ventas en este período</p>
  }

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full aspect-auto">
      <BarChart data={data} margin={{ left: 4, right: 4 }} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="mes"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(mes: string) => mesCorto.format(aFecha(mes)).replace(".", "")}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value: number) => `$${value.toLocaleString("es-EC", { maximumFractionDigits: 0 })}`}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              labelFormatter={(mes) => mesLargo.format(aFecha(String(mes)))}
              valueFormatter={(value) => formatCurrency(Number(value))}
            />
          }
        />
        <Bar dataKey="total" fill="var(--color-total)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  )
}
