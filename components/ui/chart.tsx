"use client"

// Versión reducida del chart de shadcn/ui (new-york) para recharts 3.
// Cada serie toma su color de ChartConfig y lo expone como --color-<clave>,
// que se usa en los gráficos como fill="var(--color-<clave>)".

import * as React from "react"
import * as RechartsPrimitive from "recharts"

import { cn } from "@/lib/utils"

export type ChartConfig = Record<string, { label?: React.ReactNode; color?: string }>

const ChartContext = React.createContext<{ config: ChartConfig } | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)
  if (!context) throw new Error("useChart debe usarse dentro de <ChartContainer />")
  return context
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"]
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`
  const colorVars = Object.fromEntries(
    Object.entries(config)
      .filter(([, item]) => item.color)
      .map(([key, item]) => [`--color-${key}`, item.color]),
  ) as React.CSSProperties

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        style={colorVars}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-surface]:outline-hidden [&_.recharts-sector]:outline-hidden [&_.recharts-layer]:outline-hidden",
          className,
        )}
        {...props}
      >
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

const ChartTooltip = RechartsPrimitive.Tooltip

interface TooltipItem {
  name?: string | number
  dataKey?: string | number | ((obj: unknown) => unknown)
  value?: unknown
  color?: string
  payload?: { fill?: string } & Record<string, unknown>
}

// recharts inyecta active, payload y label al clonar el elemento en `content`.
function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  hideLabel = false,
  nameKey,
  labelFormatter,
  valueFormatter = (value) => String(value),
}: {
  active?: boolean
  payload?: readonly TooltipItem[]
  label?: React.ReactNode
  className?: string
  hideLabel?: boolean
  // Campo del dato que identifica la serie en ChartConfig (p. ej. "estado").
  nameKey?: string
  labelFormatter?: (label: React.ReactNode) => React.ReactNode
  valueFormatter?: (value: unknown) => React.ReactNode
}) {
  const { config } = useChart()
  if (!active || !payload?.length) return null

  return (
    <div
      className={cn(
        "grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl",
        className,
      )}
    >
      {!hideLabel && label != null && (
        <div className="font-medium">{labelFormatter ? labelFormatter(label) : label}</div>
      )}
      <div className="grid gap-1.5">
        {payload.map((item, index) => {
          const key = String(
            (nameKey && item.payload?.[nameKey]) ?? (typeof item.dataKey === "function" ? item.name : item.dataKey) ?? "value",
          )
          const itemConfig = config[key]
          const color = itemConfig?.color ? `var(--color-${key})` : (item.payload?.fill ?? item.color)
          return (
            <div key={`${key}-${index}`} className="flex w-full items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
              <span className="flex-1 text-muted-foreground">{itemConfig?.label ?? item.name}</span>
              <span className="font-mono font-medium tabular-nums text-foreground">{valueFormatter(item.value)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { ChartContainer, ChartTooltip, ChartTooltipContent }
