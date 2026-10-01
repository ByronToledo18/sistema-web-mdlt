import type { listarEnvios } from "@/server/services/envios"
import type { listarPagos } from "@/server/services/pagos"
import type { obtenerPedido } from "@/server/services/pedidos"

// Tipos de lo que el detalle del pedido recibe del servidor (solo tipos: no
// arrastra código de servidor al bundle del cliente).
export type PedidoDetalle = Awaited<ReturnType<typeof obtenerPedido>>
export type PedidoItem = PedidoDetalle["items"][number]
export type PagoPedido = Awaited<ReturnType<typeof listarPagos>>[number]
export type EnvioPedido = Awaited<ReturnType<typeof listarEnvios>>[number]

export interface ProductoOpcion {
  id: number
  nombre: string
  precio: string
  stock: number | null
}

export interface ServicioOpcion {
  id: number
  nombre: string
  precio_base: string
}
