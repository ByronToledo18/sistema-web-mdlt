// IVA de Ecuador: única fuente de la tarifa y del cálculo de totales para
// pedidos, facturas de venta, checkout del catálogo, carrito y facturas de
// proveedores. Sin dependencias de servidor: lo importan también los
// componentes de cliente, así cliente y servidor calculan igual.
//
// Los precios del catálogo NO incluyen IVA. Cada producto/servicio indica si
// lo grava (graba_iva). El IVA del pedido se calcula sobre la BASE GRAVADA
// (método del SRI): IVA = round(Σ subtotales que gravan × 15 %), en
// centavos. El IVA por línea (ivaCents) solo es informativo.

export const IVA_PORCENTAJE = 15
export const IVA_RATE = IVA_PORCENTAJE / 100

// IVA de una base en centavos (entero), redondeado half-up a centavos. La
// cuenta es entera (× 15 / 100) para no arrastrar errores de punto flotante
// antes de redondear: 10,50 → 158 centavos (157,5 redondea hacia arriba).
// Math.round es half-up para bases positivas.
export function ivaSobreBase(baseCents: number): number {
  return Math.round((baseCents * IVA_PORCENTAJE) / 100)
}

// IVA de una sola línea (pedido_items.iva). Dato informativo: el IVA del
// pedido NO es la suma de estos valores (ver calcularTotales).
export function ivaCents(subtotalCents: number, grabaIva: boolean): number {
  return grabaIva ? ivaSobreBase(subtotalCents) : 0
}

export interface LineaIva {
  subtotalCents: number
  grabaIva: boolean
}

export interface Totales {
  // Σ subtotales de todas las líneas, sin IVA (el neto de la venta).
  subtotal: number
  // Base de los ítems que no gravan IVA ("Subtotal 0 %").
  subtotal0: number
  // Base imponible de los ítems que gravan IVA ("Subtotal 15 %").
  baseGravada: number
  // round(baseGravada × 15 %).
  iva: number
  // subtotal + iva: lo que se cobra (pedidos.total).
  total: number
}

// Totales en centavos de un conjunto de líneas, con el IVA sobre la base
// gravada. Es el cálculo de pedidos.total (recalcularTotalPedido, checkout),
// de la factura y del carrito/checkout del catálogo.
export function calcularTotales(lineas: LineaIva[]): Totales {
  let baseGravada = 0
  let subtotal0 = 0
  for (const linea of lineas) {
    if (linea.grabaIva) baseGravada += linea.subtotalCents
    else subtotal0 += linea.subtotalCents
  }
  const subtotal = baseGravada + subtotal0
  const iva = ivaSobreBase(baseGravada)
  return { subtotal, subtotal0, baseGravada, iva, total: subtotal + iva }
}
