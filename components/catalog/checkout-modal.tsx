"use client"

import type React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert } from "@/components/ui/alert"
import { X, Loader2, Search } from "lucide-react"
import { useState, useEffect } from "react"
import { getCart, clearCart } from "@/lib/cart"

interface CheckoutModalProps {
  isOpen: boolean
  onClose: () => void
}

interface Tarifa {
  id: number
  ciudad: string
  provincia: string | null
  costo: string
  activo: boolean
}

export function CheckoutModal({ isOpen, onClose }: CheckoutModalProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [pedidoCodigo, setPedidoCodigo] = useState("")
  const [costoEnvio, setCostoEnvio] = useState(0)
  const [ciudadEnvio, setCiudadEnvio] = useState("")
  const [isClientLoggedIn, setIsClientLoggedIn] = useState(false)
  const [clientData, setClientData] = useState<any>(null)

  const [tarifas, setTarifas] = useState<Tarifa[]>([])
  const [ciudadSearch, setCiudadSearch] = useState("")
  const [showCiudadDropdown, setShowCiudadDropdown] = useState(false)

  const [formData, setFormData] = useState({
    nombre: "",
    cedula: "",
    telefono: "",
    email: "",
    direccion: "",
    direccionEnvio: "",
    metodoEntrega: "envio" as "envio" | "retiro",
    usarMismaDireccion: true,
  })

  const cart = getCart()
  const subtotal = cart.total
  const total = formData.metodoEntrega === "envio" ? subtotal + costoEnvio : subtotal

  useEffect(() => {
    if (isOpen) {
      checkClientAuth()
      fetchTarifas()
    }
  }, [isOpen])

  const fetchTarifas = async () => {
    try {
      const response = await fetch("/api/tarifas-envio")
      const data = await response.json()
      if (response.ok) {
        setTarifas(data.tarifas || [])
      }
    } catch (error) {
      console.error("[v0] Error fetching tarifas:", error)
    }
  }

  const checkClientAuth = async () => {
    try {
      const response = await fetch("/api/portal/me")
      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Client data from API:", data.cliente)
        setIsClientLoggedIn(true)
        setClientData(data.cliente)
        setFormData({
          ...formData,
          nombre: data.cliente.nombre || "",
          cedula: data.cliente.cedula || "",
          telefono: data.cliente.telefono || "",
          email: data.cliente.email || "",
          direccion: data.cliente.direccion || "",
        })
        console.log("[v0] Form data after setting:", {
          cedula: data.cliente.cedula,
          nombre: data.cliente.nombre,
        })
      }
    } catch (error) {
      console.error("[v0] Error checking client auth:", error)
      setIsClientLoggedIn(false)
    }
  }

  const handleCiudadSelect = (tarifa: Tarifa) => {
    setCiudadEnvio(tarifa.ciudad)
    setCostoEnvio(Number(tarifa.costo))
    setCiudadSearch(tarifa.ciudad)
    setShowCiudadDropdown(false)
  }

  const filteredTarifas = tarifas.filter((t) => t.ciudad.toLowerCase().includes(ciudadSearch.toLowerCase()))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isClientLoggedIn) {
      const shouldLogin = confirm(
        "Para realizar un pedido, necesitas iniciar sesión. ¿Deseas ir a la página de inicio de sesión?",
      )
      if (shouldLogin) {
        window.location.href = "/portal/login"
      }
      return
    }

    if (formData.metodoEntrega === "envio" && !ciudadEnvio) {
      alert("Por favor selecciona una ciudad para el envío")
      return
    }

    setLoading(true)

    try {
      const direccionEnvioFinal =
        formData.metodoEntrega === "envio"
          ? formData.usarMismaDireccion
            ? formData.direccion
            : formData.direccionEnvio
          : null

      const response = await fetch("/api/catalogo/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cliente: {
            nombre: formData.nombre,
            cedula: formData.cedula,
            telefono: formData.telefono,
            email: formData.email,
            direccion: formData.direccion,
          },
          items: cart.items,
          metodoEntrega: formData.metodoEntrega,
          direccionEnvio: direccionEnvioFinal,
          ciudadEnvio: formData.metodoEntrega === "envio" ? ciudadEnvio : null,
          costoEnvio: formData.metodoEntrega === "envio" ? costoEnvio : 0,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Error al crear el pedido")
      }

      setPedidoCodigo(data.pedido.codigo)
      setSuccess(true)
      clearCart()
    } catch (error: any) {
      alert(error.message || "Error al procesar el pedido")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setSuccess(false)
    setPedidoCodigo("")
    setCostoEnvio(0)
    setCiudadEnvio("")
    setCiudadSearch("")
    setShowCiudadDropdown(false)
    if (!isClientLoggedIn) {
      setFormData({
        nombre: "",
        cedula: "",
        telefono: "",
        email: "",
        direccion: "",
        direccionEnvio: "",
        metodoEntrega: "envio",
        usarMismaDireccion: true,
      })
    }
    onClose()
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-50 transition-opacity duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)]",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={handleClose}
      />
      <div
        aria-hidden={!isOpen}
        className={cn(
          "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-card rounded-lg shadow-2xl z-50 max-h-[90vh] overflow-y-auto",
          "transition-[opacity,transform] duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity",
          isOpen
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none motion-reduce:scale-100",
        )}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-foreground">
            {success ? "¡Pedido Recibido!" : "Finalizar Pedido"}
          </h2>
          <Button variant="ghost" size="icon" onClick={handleClose} aria-label="Cerrar formulario de pedido">
            <X className="h-5 w-5 text-foreground" />
          </Button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground">¡Gracias por tu pedido!</h3>
              <p className="text-muted-foreground">Tu pedido ha sido recibido con el código:</p>
              <p className="text-2xl font-bold text-primary">{pedidoCodigo}</p>
              <p className="text-sm text-muted-foreground">
                Nos pondremos en contacto contigo pronto para confirmar los detalles.
              </p>
              <Button onClick={handleClose} className="w-full">
                Cerrar
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isClientLoggedIn && (
                <Alert className="border-amber-500 bg-amber-50">
                  <div className="text-amber-800">
                    Para realizar un pedido, necesitas{" "}
                    <a href="/portal/login" className="underline font-semibold">
                      iniciar sesión
                    </a>{" "}
                    o{" "}
                    <a href="/portal/registro" className="underline font-semibold">
                      registrarte
                    </a>
                    .
                  </div>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="nombre" className="text-foreground">
                  Nombre Completo *
                </Label>
                <Input
                  id="nombre"
                  required
                  className="bg-background text-foreground border-border"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  disabled={isClientLoggedIn}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cedula" className="text-foreground">
                  Cédula *
                </Label>
                <Input
                  id="cedula"
                  required
                  className="bg-background text-foreground border-border"
                  placeholder="Número de cédula"
                  value={formData.cedula}
                  onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                  disabled={isClientLoggedIn}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono" className="text-foreground">
                  Teléfono *
                </Label>
                <Input
                  id="telefono"
                  type="tel"
                  required
                  className="bg-background text-foreground border-border"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  disabled={isClientLoggedIn}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">
                  Email *
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  className="bg-background text-foreground border-border"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={isClientLoggedIn}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="direccion" className="text-foreground">
                  Dirección de Domicilio *
                </Label>
                <Textarea
                  id="direccion"
                  rows={3}
                  required
                  className="bg-background text-foreground border-border"
                  placeholder="Calle, número, ciudad..."
                  value={formData.direccion}
                  onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                  disabled={isClientLoggedIn}
                  readOnly={isClientLoggedIn}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Método de Entrega *</Label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="metodoEntrega"
                      value="envio"
                      checked={formData.metodoEntrega === "envio"}
                      onChange={(e) => setFormData({ ...formData, metodoEntrega: "envio" })}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-foreground">Envío a Domicilio</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="metodoEntrega"
                      value="retiro"
                      checked={formData.metodoEntrega === "retiro"}
                      onChange={(e) => {
                        setFormData({ ...formData, metodoEntrega: "retiro" })
                        setCostoEnvio(0)
                        setCiudadEnvio("")
                        setCiudadSearch("")
                      }}
                      className="w-4 h-4 text-primary"
                    />
                    <span className="text-foreground">Retiro en Tienda</span>
                  </label>
                </div>
              </div>

              {formData.metodoEntrega === "envio" && (
                <>
                  <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
                    <Label className="text-foreground font-semibold">Ciudad de Envío *</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar ciudad..."
                        value={ciudadSearch}
                        onChange={(e) => {
                          setCiudadSearch(e.target.value)
                          setShowCiudadDropdown(true)
                        }}
                        onFocus={() => setShowCiudadDropdown(true)}
                        className="pl-10"
                      />
                      {showCiudadDropdown && filteredTarifas.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                          {filteredTarifas.map((tarifa) => (
                            <button
                              key={tarifa.id}
                              type="button"
                              onClick={() => handleCiudadSelect(tarifa)}
                              className="w-full px-4 py-2 text-left hover:bg-muted flex items-center justify-between"
                            >
                              <div>
                                <p className="font-medium text-foreground">{tarifa.ciudad}</p>
                                {tarifa.provincia && (
                                  <p className="text-xs text-muted-foreground">{tarifa.provincia}</p>
                                )}
                              </div>
                              <span className="text-sm font-semibold text-primary">
                                ${Number(tarifa.costo).toFixed(2)}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {ciudadEnvio && (
                      <div className="flex items-center justify-between p-3 bg-primary/10 rounded-md">
                        <span className="text-sm font-medium text-foreground">Ciudad seleccionada:</span>
                        <span className="text-sm font-bold text-primary">{ciudadEnvio}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
                    <Label className="text-foreground font-semibold">Dirección de Envío</Label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.usarMismaDireccion}
                        onChange={(e) => setFormData({ ...formData, usarMismaDireccion: e.target.checked })}
                        className="w-4 h-4 text-primary"
                      />
                      <span className="text-sm text-foreground">Usar la misma dirección de domicilio</span>
                    </label>

                    {!formData.usarMismaDireccion && (
                      <div className="space-y-2">
                        <Label htmlFor="direccionEnvio" className="text-foreground text-sm">
                          Dirección de Envío Diferente
                        </Label>
                        <Textarea
                          id="direccionEnvio"
                          rows={3}
                          className="bg-background text-foreground border-border"
                          placeholder="Ingrese la dirección de envío..."
                          value={formData.direccionEnvio}
                          onChange={(e) => setFormData({ ...formData, direccionEnvio: e.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="space-y-2 p-4 bg-muted/50 rounded-lg border border-border">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="text-foreground font-medium">${subtotal.toFixed(2)}</span>
                </div>
                {formData.metodoEntrega === "envio" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Costo de Envío:</span>
                    <span className="text-foreground font-medium">
                      {ciudadEnvio ? `$${costoEnvio.toFixed(2)}` : "Selecciona ciudad"}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span className="text-foreground">Total:</span>
                  <span className="text-primary">${total.toFixed(2)}</span>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading || !isClientLoggedIn}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isClientLoggedIn ? "Confirmar Pedido" : "Iniciar Sesión para Continuar"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </>
  )
}
