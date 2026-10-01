import "server-only"

import { count, inArray, sql, type SQL } from "drizzle-orm"
import { ZONA_NEGOCIO as ZONA } from "@/lib/fechas"
import { IVA_PORCENTAJE } from "@/lib/iva"
import { db } from "@/server/db/client"
import { clientes, PEDIDO_ESTADOS, pedidoItems, pedidos, productos } from "@/server/db/schema"
import { queryRows } from "./_shared"

const STOCK_BAJO = 5

export type TipoActividad = "pedido" | "pago" | "envio"

export interface Actividad {
  tipo: TipoActividad
  id: number
  descripcion: string
  fecha: Date
}

// Números del dashboard y las últimas 5 acciones (pedidos, cobros, envíos).
//
// El IVA no es ingreso de la tienda: las ventas se muestran en NETO
// (pedidos.total − IVA del pedido) y, como dato secundario, con IVA
// (pedidos.total). El IVA del pedido es el mismo que suma pedidos.total
// (lib/iva.ts: round(Σ subtotales gravados × 15 %)), así que el neto es la
// suma de los subtotales de sus líneas. Los pedidos anteriores a la migración
// 0003 no tienen líneas que graven IVA: su neto es su total histórico. Los
// cobros siguen siendo con IVA, que es lo que paga el cliente.
export async function resumenDashboard() {
  const [pedidosActivos, clientesTotales, productosData, ventasMes, actividad] = await Promise.all([
    db.select({ value: count() }).from(pedidos).where(inArray(pedidos.estado, ["recibido", "en_proceso"])),
    db.select({ value: count() }).from(clientes),
    db
      .select({
        total: count(),
        bajo_stock: sql<number>`COUNT(*) FILTER (WHERE ${productos.stock} <= ${STOCK_BAJO})`.mapWith(Number),
      })
      .from(productos)
      .where(sql`${productos.activo} = true`),
    // El mes se calcula en la hora de Ecuador y no cuenta los anulados (igual
    // que ventasPorMes).
    db
      .select({
        con_iva: sql<string>`COALESCE(SUM(${pedidos.total}), 0)`,
        neto: sql<string>`COALESCE(SUM(${pedidos.total} - ${ivaDelPedido(sql`${pedidos.id}`)}), 0)`,
      })
      .from(pedidos)
      .where(
        sql`DATE_TRUNC('month', ${horaLocal(sql`${pedidos.created_at}`)}) = DATE_TRUNC('month', CURRENT_TIMESTAMP AT TIME ZONE ${ZONA})
          AND ${pedidos.estado} IS DISTINCT FROM 'anulado'`,
      ),
    queryRows<{ tipo: TipoActividad; id: number; descripcion: string; fecha: string | Date }>(
      db,
      sql`
        SELECT 'pedido' AS tipo, p.id, 'Pedido #' || p.id || ' - ' || c.nombre AS descripcion, p.created_at AS fecha
        FROM pedidos p
        JOIN clientes c ON p.cliente_id = c.id
        UNION ALL
        SELECT 'pago' AS tipo, pg.id, 'Pago de $' || pg.monto || ' - Pedido #' || pg.pedido_id AS descripcion, pg.fecha AS fecha
        FROM pagos pg
        UNION ALL
        SELECT 'envio' AS tipo, e.id, 'Envío ' || e.guia || ' - Pedido #' || e.pedido_id AS descripcion, e.created_at AS fecha
        FROM envios e
        ORDER BY fecha DESC
        LIMIT 5
      `,
    ),
  ])

  return {
    pedidosActivos: pedidosActivos[0]?.value ?? 0,
    clientesTotales: clientesTotales[0]?.value ?? 0,
    productos: productosData[0]?.total ?? 0,
    bajoStock: productosData[0]?.bajo_stock ?? 0,
    // Neto (sin IVA) y con IVA de los pedidos del mes.
    ventasMes: { neto: Number(ventasMes[0]?.neto ?? 0), conIva: Number(ventasMes[0]?.con_iva ?? 0) },
    actividad: actividad.map((a): Actividad => ({ ...a, id: Number(a.id), fecha: aFecha(a.fecha) })),
  }
}

export interface VentasMes {
  mes: string // "2026-09"
  // Ventas netas, sin IVA (pedidos.total − IVA del pedido).
  neto: number
  // Ventas con IVA (pedidos.total), lo que se cobra.
  conIva: number
  pedidos: number
}

// Ventas (sin anulados) de los últimos `meses` meses en la hora de Ecuador,
// incluido el actual, en neto y con IVA. Los meses sin pedidos vienen en 0.
export async function ventasPorMes(meses = 12, ahora: Date = new Date()): Promise<VentasMes[]> {
  const mesActual = sql`DATE_TRUNC('month', ${ahora.toISOString()}::timestamptz AT TIME ZONE ${ZONA})`
  const rows = await queryRows<{ mes: string; neto: string; con_iva: string; pedidos: string | number }>(
    db,
    sql`
      WITH meses AS (
        SELECT generate_series(${mesActual} - make_interval(months => ${meses - 1}), ${mesActual}, interval '1 month') AS mes
      )
      SELECT to_char(m.mes, 'YYYY-MM') AS mes,
        COALESCE(SUM(p.total - ${ivaDelPedido(sql`p.id`)}), 0) AS neto,
        COALESCE(SUM(p.total), 0) AS con_iva,
        COUNT(p.id) AS pedidos
      FROM meses m
      LEFT JOIN pedidos p
        ON DATE_TRUNC('month', ${horaLocal(sql`p.created_at`)}) = m.mes
        AND p.estado IS DISTINCT FROM 'anulado'
      GROUP BY m.mes
      ORDER BY m.mes
    `,
  )
  return rows.map((r) => ({
    mes: r.mes,
    neto: Number(r.neto),
    conIva: Number(r.con_iva),
    pedidos: Number(r.pedidos),
  }))
}

export type EstadoPedido = (typeof PEDIDO_ESTADOS)[number]

// Cantidad de pedidos por estado; los 5 estados siempre aparecen, en el orden
// del flujo.
export async function pedidosPorEstado(): Promise<{ estado: EstadoPedido; cantidad: number }[]> {
  const rows = await db.select({ estado: pedidos.estado, cantidad: count() }).from(pedidos).groupBy(pedidos.estado)
  const porEstado = new Map(rows.map((r) => [r.estado, r.cantidad]))
  return PEDIDO_ESTADOS.map((estado) => ({ estado, cantidad: porEstado.get(estado) ?? 0 }))
}

// IVA de un pedido en SQL, igual que calcularTotales (lib/iva.ts): la base
// gravada (Σ subtotales de las líneas con graba_iva) × 15 %, redondeada a
// centavos (ROUND de numeric redondea half-up para positivos, como
// Math.round). Sin líneas gravadas es 0.
function ivaDelPedido(pedidoId: SQL) {
  return sql`ROUND(COALESCE((
    SELECT SUM(${pedidoItems.subtotal}) FROM ${pedidoItems}
    WHERE ${pedidoItems.pedido_id} = ${pedidoId} AND ${pedidoItems.graba_iva}
  ), 0) * ${IVA_PORCENTAJE}::numeric / 100, 2)`
}

// Las columnas timestamp (sin zona) guardan UTC: primero se marcan como UTC y
// luego se pasan a la hora local de Ecuador.
function horaLocal(columna: SQL) {
  return sql`((${columna}) AT TIME ZONE 'UTC') AT TIME ZONE ${ZONA}`
}

// En SQL crudo la fecha puede llegar como Date o como texto sin zona
// ("2026-09-06 04:17:14.535"); las columnas timestamp guardan UTC.
function aFecha(value: string | Date): Date {
  if (value instanceof Date) return value
  return new Date(`${value.replace(" ", "T")}Z`)
}
