"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { BackButton } from "@/components/ui/back-button"
import { Sparkles, Loader2, ShoppingCart } from "lucide-react"
import Image from "next/image"
import { addToCart } from "@/lib/cart"

const DISENO_SERVICIO_NOMBRE = "Diseño Personalizado con IA"

interface Diseno {
  id: number
  descripcion: string
  imagen_url: string
}

export default function DisenarTutuPage() {
  const router = useRouter()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [descripcion, setDescripcion] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [diseno, setDiseno] = useState<Diseno | null>(null)
  const [addedToCart, setAddedToCart] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/portal/me")
      setIsLoggedIn(response.ok)
    } catch {
      setIsLoggedIn(false)
    } finally {
      setCheckingAuth(false)
    }
  }

  const handleGenerar = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setDiseno(null)
    setAddedToCart(false)

    if (descripcion.trim().length < 10) {
      setError("Describe tu diseño con al menos 10 caracteres")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/catalogo/disenar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: descripcion.trim() }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "Error al generar el diseño")
        return
      }

      setDiseno(data.diseno)
    } catch {
      setError("Error de conexión al generar el diseño")
    } finally {
      setLoading(false)
    }
  }

  const handleAgregarAlCarrito = async () => {
    try {
      const response = await fetch("/api/catalogo/servicios")
      const servicios = await response.json()
      const servicioDiseno = servicios.find((s: any) => s.nombre === DISENO_SERVICIO_NOMBRE)

      if (!servicioDiseno) {
        setError("El servicio de diseño personalizado no está disponible en el catálogo por ahora")
        return
      }

      addToCart({
        id: servicioDiseno.id,
        tipo: "servicio",
        nombre: DISENO_SERVICIO_NOMBRE,
        precio: Number.parseFloat(servicioDiseno.precio_base),
        unidad: servicioDiseno.unidad,
      })
      setAddedToCart(true)
    } catch {
      setError("Error al agregar al carrito")
    }
  }

  if (checkingAuth) {
    return <div className="p-6 text-center">Cargando...</div>
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Inicia sesión para diseñar tu tutú</CardTitle>
            <CardDescription>Necesitas una cuenta para usar el diseñador con IA</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => router.push("/portal/login")}>
              Iniciar sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <BackButton href="/catalogo" />
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-primary" />
              Diseña tu Tutú
            </h1>
            <p className="text-muted-foreground">Describe cómo lo imaginas y una IA genera una vista previa</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleGenerar} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Textarea
                placeholder="Ej: Tutú rosa pastel con lentejuelas plateadas, capas de tul esponjoso, para niña de 5 años, estilo princesa de cuento"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={4}
                maxLength={500}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground text-right">{descripcion.length}/500</p>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando diseño...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generar Vista Previa
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {diseno && (
          <Card>
            <CardHeader>
              <CardTitle>Vista previa de tu diseño</CardTitle>
              <CardDescription>{diseno.descripcion}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-muted">
                <Image src={diseno.imagen_url || "/placeholder.svg"} alt="Diseño generado" fill className="object-cover" />
              </div>

              {addedToCart ? (
                <Alert>
                  <AlertDescription>
                    Agregado al carrito. Un miembro de nuestro equipo confirmará los detalles finales contigo antes de
                    confeccionarlo.
                  </AlertDescription>
                </Alert>
              ) : (
                <Button className="w-full" onClick={handleAgregarAlCarrito}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Agregar al Carrito
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
