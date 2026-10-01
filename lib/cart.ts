import { calcularTotales, type Totales } from "@/lib/iva"

export interface CartItem {
  id: number
  tipo: "producto" | "servicio"
  nombre: string
  precio: number
  cantidad: number
  imagen_url?: string | null
  stock?: number
  unidad?: string
  // Si grava IVA. Los carritos guardados antes de este campo no lo traen: se
  // asume que grava (el valor por defecto del catálogo).
  graba_iva?: boolean
}

export interface Cart {
  items: CartItem[]
  total: number
}

const CART_KEY = "mdlt_cart"

export function getCart(): Cart {
  if (typeof window === "undefined") return { items: [], total: 0 }

  const stored = localStorage.getItem(CART_KEY)
  if (!stored) return { items: [], total: 0 }

  try {
    return JSON.parse(stored)
  } catch {
    return { items: [], total: 0 }
  }
}

export function saveCart(cart: Cart): void {
  if (typeof window === "undefined") return
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
}

export function addToCart(item: Omit<CartItem, "cantidad">, cantidad = 1): Cart {
  const cart = getCart()

  const existingIndex = cart.items.findIndex((i) => i.id === item.id && i.tipo === item.tipo)

  if (existingIndex >= 0) {
    cart.items[existingIndex].cantidad += cantidad
  } else {
    cart.items.push({ ...item, cantidad })
  }

  cart.total = cart.items.reduce((sum, i) => sum + i.precio * i.cantidad, 0)
  saveCart(cart)

  return cart
}

export function removeFromCart(id: number, tipo: "producto" | "servicio"): Cart {
  const cart = getCart()
  cart.items = cart.items.filter((i) => !(i.id === id && i.tipo === tipo))
  cart.total = cart.items.reduce((sum, i) => sum + i.precio * i.cantidad, 0)
  saveCart(cart)
  return cart
}

export function updateQuantity(id: number, tipo: "producto" | "servicio", cantidad: number): Cart {
  const cart = getCart()
  const item = cart.items.find((i) => i.id === id && i.tipo === tipo)

  if (item) {
    item.cantidad = Math.max(1, cantidad)
    cart.total = cart.items.reduce((sum, i) => sum + i.precio * i.cantidad, 0)
    saveCart(cart)
  }

  return cart
}

export function clearCart(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(CART_KEY)
}

// Desglose del carrito (y del envío, si lo hay) en centavos, con el IVA sobre
// la base gravada igual que el servidor (lib/iva.ts). Solo es informativo: el
// pedido lo recalcula el servidor con los precios y flags de la base.
export function desgloseCarrito(
  items: CartItem[],
  envio?: { costo: number; grabaIva: boolean } | null,
): Totales {
  const lineas = items.map((item) => ({
    subtotalCents: Math.round(Math.round(item.precio * 100) * item.cantidad),
    grabaIva: item.graba_iva !== false,
  }))
  if (envio && envio.costo > 0) {
    lineas.push({ subtotalCents: Math.round(envio.costo * 100), grabaIva: envio.grabaIva })
  }
  return calcularTotales(lineas)
}
