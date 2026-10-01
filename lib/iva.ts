// IVA de Ecuador: única fuente de la tarifa para pedidos, facturas de venta,
// checkout del catálogo y facturas de proveedores. Sin dependencias de
// servidor: lo importan también los componentes de cliente.
//
// Los precios del catálogo NO incluyen IVA. Cada producto/servicio indica si
// lo grava (graba_iva) y el IVA se calcula y redondea por línea, en centavos.

export const IVA_PORCENTAJE = 15
export const IVA_RATE = IVA_PORCENTAJE / 100

// IVA de una línea a partir de su subtotal en centavos (entero). La cuenta es
// entera (× 15 / 100) para no arrastrar errores de punto flotante antes de
// redondear: 10,50 → 158 centavos (157,5 redondea hacia arriba).
export function ivaCents(subtotalCents: number, grabaIva: boolean): number {
  return grabaIva ? Math.round((subtotalCents * IVA_PORCENTAJE) / 100) : 0
}

export interface LineaIva {
  subtotalCents: number
  grabaIva: boolean
}

export interface DesgloseIva {
  // Base imponible de los ítems que gravan IVA ("Subtotal 15 %").
  subtotalGravado: number
  // Base de los ítems que no lo gravan ("Subtotal 0 %").
  subtotal0: number
  // subtotalGravado + subtotal0.
  subtotal: number
  // Suma del IVA de cada línea (redondeado por línea).
  iva: number
  total: number
}

// Desglose en centavos de un conjunto de líneas.
export function desgloseIva(lineas: LineaIva[]): DesgloseIva {
  let subtotalGravado = 0
  let subtotal0 = 0
  let iva = 0
  for (const linea of lineas) {
    if (linea.grabaIva) subtotalGravado += linea.subtotalCents
    else subtotal0 += linea.subtotalCents
    iva += ivaCents(linea.subtotalCents, linea.grabaIva)
  }
  const subtotal = subtotalGravado + subtotal0
  return { subtotalGravado, subtotal0, subtotal, iva, total: subtotal + iva }
}
