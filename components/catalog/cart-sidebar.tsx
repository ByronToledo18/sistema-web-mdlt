"use client"

import { useState, useEffect } from "react"
import { X, ShoppingCart, Minus, Plus, Trash2, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getCart, removeFromCart, updateQuantity, type Cart } from "@/lib/cart"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { cn } from "@/lib/utils"

interface CartSidebarProps {
  isOpen: boolean
  onClose: () => void
  onCheckout: () => void
}

export function CartSidebar({ isOpen, onClose, onCheckout }: CartSidebarProps) {
  const [cart, setCart] = useState<Cart>({ items: [], total: 0 })
  const [removingKeys, setRemovingKeys] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isOpen) {
      setCart(getCart())
    }
  }, [isOpen])

  const handleRemove = (id: number, tipo: "producto" | "servicio") => {
    const key = `${tipo}-${id}`
    // El item sale con transición antes de quitarse del estado real - ver
    // .cart-item[data-removing] en globals.css. 200ms coincide con la
    // duración de esa transición. Un Set (no un solo string) permite
    // eliminar varios ítems en sucesión rápida sin que el segundo cancele
    // la animación de salida del primero.
    setRemovingKeys((prev) => new Set(prev).add(key))
    setTimeout(() => {
      const newCart = removeFromCart(id, tipo)
      setCart(newCart)
      setRemovingKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }, 200)
  }

  const handleUpdateQuantity = (id: number, tipo: "producto" | "servicio", cantidad: number) => {
    const newCart = updateQuantity(id, tipo, cantidad)
    setCart(newCart)
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "cart-drawer-overlay fixed inset-0 bg-black/50 z-50 transition-opacity duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={cn(
          "cart-drawer fixed right-0 top-0 h-full w-full max-w-md bg-card shadow-2xl z-50 flex flex-col",
          "transition-transform ease-[cubic-bezier(0.32,0.72,0,1)]",
          isOpen ? "translate-x-0 duration-[320ms]" : "translate-x-full duration-[280ms] pointer-events-none",
        )}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold text-foreground">Carrito de Compras</h2>
            <Badge variant="secondary">{cart.items.length}</Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar carrito">
            <X className="h-5 w-5 text-foreground" />
          </Button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Tu carrito está vacío</p>
            </div>
          ) : (
            <>
              {cart.items.map((item) => (
                <div
                  key={`${item.tipo}-${item.id}`}
                  data-removing={removingKeys.has(`${item.tipo}-${item.id}`)}
                  className="cart-item flex gap-4 p-4 border rounded-lg bg-background"
                >
                  {item.imagen_url && (
                    <img
                      src={item.imagen_url || "/placeholder.svg"}
                      alt={item.nombre}
                      className="w-20 h-20 object-cover rounded"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate text-foreground">{item.nombre}</h3>
                    <p className="text-sm text-muted-foreground">
                      ${item.precio.toFixed(2)} {item.unidad && `/ ${item.unidad}`}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 bg-background border-border hover:bg-accent"
                        onClick={() => handleUpdateQuantity(item.id, item.tipo, item.cantidad - 1)}
                        disabled={item.cantidad <= 1}
                        aria-label={`Disminuir cantidad de ${item.nombre}`}
                      >
                        <Minus className="h-3 w-3 text-foreground" />
                      </Button>
                      <span className="text-sm font-medium w-8 text-center text-foreground">{item.cantidad}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 bg-background border-border hover:bg-accent"
                        onClick={() => handleUpdateQuantity(item.id, item.tipo, item.cantidad + 1)}
                        disabled={item.tipo === "producto" && item.stock !== undefined && item.cantidad >= item.stock}
                        aria-label={`Aumentar cantidad de ${item.nombre}`}
                      >
                        <Plus className="h-3 w-3 text-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 ml-auto hover:bg-destructive/10"
                        onClick={() => handleRemove(item.id, item.tipo)}
                        aria-label={`Eliminar ${item.nombre} del carrito`}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-foreground">${(item.precio * item.cantidad).toFixed(2)}</p>
                  </div>
                </div>
              ))}

              <Alert className="bg-blue-50 border-blue-200">
                <Truck className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-sm text-blue-900">
                  El costo de envío se calculará en el siguiente paso según tu ciudad
                </AlertDescription>
              </Alert>
            </>
          )}
        </div>

        {/* Footer */}
        {cart.items.length > 0 && (
          <div className="border-t p-6 space-y-4 bg-card">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal:</span>
                <span className="text-foreground font-medium">${cart.total.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>+ Costo de envío</span>
                <span>(se calcula en checkout)</span>
              </div>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={() => {
                onClose()
                onCheckout()
              }}
            >
              Proceder al Pago
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
