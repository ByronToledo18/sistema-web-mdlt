"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShoppingCart, Package, Sparkles, Plus, User, LogOut, Settings } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CartSidebar } from "@/components/catalog/cart-sidebar"
import { CheckoutModal } from "@/components/catalog/checkout-modal"
import { addToCart, getCart } from "@/lib/cart"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface Producto {
  id: number
  sku: string
  nombre: string
  precio: number
  stock: number
  imagen_url: string | null
  tipo: "producto"
}

interface Servicio {
  id: number
  nombre: string
  unidad: string
  precio: number
  variable: boolean
  imagen_url: string | null
  tipo: "servicio"
}

export default function CatalogoPage() {
  const router = useRouter()
  const [productos, setProductos] = useState<Producto[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [isClientLoggedIn, setIsClientLoggedIn] = useState(false)
  const [clientName, setClientName] = useState("")

  useEffect(() => {
    fetchData()
    updateCartCount()
    checkClientAuth()
  }, [])

  const fetchData = async () => {
    try {
      const response = await fetch("/api/catalogo/items")
      const data = await response.json()

      setProductos(data.productos || [])
      setServicios(data.servicios || [])
    } catch (error) {
      console.error("[v0] Error fetching catalog data:", error)
    }
  }

  const updateCartCount = () => {
    const cart = getCart()
    setCartCount(cart.items.length)
  }

  const checkClientAuth = async () => {
    try {
      const response = await fetch("/api/portal/me")
      if (response.ok) {
        const data = await response.json()
        setIsClientLoggedIn(true)
        setClientName(data.cliente.nombre)
      }
    } catch (error) {
      // Not logged in, that's okay
    }
  }

  const handleAddToCart = (item: any, tipo: "producto" | "servicio") => {
    addToCart(
      {
        id: item.id,
        tipo,
        nombre: item.nombre,
        precio: tipo === "producto" ? item.precio : item.precio,
        imagen_url: item.imagen_url,
        stock: item.stock,
        unidad: item.unidad,
      },
      1,
    )
    updateCartCount()
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/portal/logout", { method: "POST" })
      setIsClientLoggedIn(false)
      setClientName("")
      window.location.href = "/catalogo"
    } catch (err) {
      console.error("[v0] Error logging out:", err)
    }
  }

  return (
    <div className="catalog-theme min-h-screen bg-background">
      <header className="border-b bg-card/90 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="animate-fade-in-up">
              <h1 className="text-3xl font-bold text-foreground">El Mundo de las Tutus</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary animate-pulse-soft" />
                Catálogo de Productos y Servicios
              </p>
            </div>
            <div className="flex items-center gap-3">
              {isClientLoggedIn ? (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    className="relative bg-card text-foreground hover:bg-accent"
                    onClick={() => setCartOpen(true)}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    {cartCount > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground">
                        {cartCount}
                      </Badge>
                    )}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                        <Avatar className="h-10 w-10 border-2 border-primary">
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {clientName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56 z-[100]" align="end" forceMount>
                      <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-1">
                          <p className="text-sm font-medium leading-none text-foreground">{clientName}</p>
                          <p className="text-xs leading-none text-muted-foreground">Cliente</p>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push("/portal/pedidos")} className="cursor-pointer">
                        <Package className="mr-2 h-4 w-4" />
                        <span className="text-gray-900">Mis Pedidos</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push("/portal/perfil")} className="cursor-pointer">
                        <Settings className="mr-2 h-4 w-4" />
                        <span className="text-gray-900">Mi Perfil</span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                        <LogOut className="mr-2 h-4 w-4" />
                        <span>Cerrar Sesión</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <Link href="/portal/login">
                    <Button variant="default" className="gap-2">
                      <User className="h-4 w-4" />
                      Portal Cliente
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="icon"
                    className="relative bg-card text-foreground hover:bg-accent"
                    onClick={() => setCartOpen(true)}
                  >
                    <ShoppingCart className="h-5 w-5" />
                    {cartCount > 0 && (
                      <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs bg-primary text-primary-foreground">
                        {cartCount}
                      </Badge>
                    )}
                  </Button>
                  <Link href="/login">
                    <Button variant="outline" className="text-foreground hover:text-foreground bg-transparent">
                      Acceso Sistema
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <section className="container mx-auto px-4 py-16 text-center">
        <div className="space-y-4 animate-fade-in-up">
          <h2 className="text-4xl md:text-5xl font-bold text-balance text-foreground">
            Descubre Nuestros Productos y Servicios
          </h2>
          <p className="text-lg text-muted-foreground text-balance max-w-2xl mx-auto">
            Tutús personalizados, accesorios elegantes y servicios de confección profesional
          </p>
        </div>
      </section>

      <section className="container mx-auto px-4 pb-16">
        <Tabs defaultValue="productos" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-12">
            <TabsTrigger value="productos" className="gap-2">
              <Package className="h-4 w-4" />
              Productos
            </TabsTrigger>
            <TabsTrigger value="servicios" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Servicios
            </TabsTrigger>
          </TabsList>

          <TabsContent value="productos" className="mt-8">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {productos.map((producto) => (
                <Card
                  key={producto.id}
                  className="overflow-hidden group border-0 shadow-lg hover:shadow-xl transition-shadow"
                >
                  <div className="relative h-[400px] w-full overflow-hidden bg-muted">
                    <img
                      src={producto.imagen_url || "/placeholder.svg?height=400&width=400&query=elegant ballet tutu"}
                      alt={producto.nombre}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    {producto.stock > 0 && producto.stock <= 5 && (
                      <Badge className="absolute top-4 right-4 bg-amber-500 text-white shadow-lg">
                        ¡Últimas {producto.stock}!
                      </Badge>
                    )}
                    {producto.stock === 0 && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                        <Badge variant="secondary" className="text-lg px-6 py-2">
                          Agotado
                        </Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-6">
                    <h3 className="font-semibold text-xl mb-2 text-foreground">{producto.nombre}</h3>
                    {producto.sku && <p className="text-sm text-muted-foreground mb-4">SKU: {producto.sku}</p>}
                    <p className="text-3xl font-bold text-primary">${producto.precio.toFixed(2)}</p>
                  </CardContent>
                  <CardFooter className="p-6 pt-0">
                    <Button
                      className="w-full gap-2 h-11"
                      disabled={producto.stock === 0}
                      onClick={() => handleAddToCart(producto, "producto")}
                    >
                      <Plus className="h-5 w-5" />
                      Agregar al Carrito
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {productos.length === 0 && (
              <div className="text-center py-16">
                <Package className="h-20 w-20 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-lg text-muted-foreground">No hay productos disponibles</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="servicios" className="mt-8">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {servicios.map((servicio) => (
                <Card
                  key={servicio.id}
                  className="overflow-hidden group border-0 shadow-lg hover:shadow-xl transition-shadow"
                >
                  {servicio.imagen_url && (
                    <div className="relative h-[320px] w-full overflow-hidden bg-muted">
                      <img
                        src={servicio.imagen_url || "/placeholder.svg"}
                        alt={servicio.nombre}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-xl mb-1 text-foreground">{servicio.nombre}</h3>
                        {servicio.unidad && <p className="text-sm text-muted-foreground">Por {servicio.unidad}</p>}
                      </div>
                      {servicio.variable && (
                        <Badge variant="outline" className="ml-2">
                          Precio Variable
                        </Badge>
                      )}
                    </div>
                    <div className="mb-4">
                      <p className="text-3xl font-bold text-primary">
                        ${servicio.precio.toFixed(2)}
                        {servicio.variable && (
                          <span className="text-sm font-normal text-muted-foreground ml-2">desde</span>
                        )}
                      </p>
                    </div>
                  </CardContent>
                  <CardFooter className="p-6 pt-0">
                    <Button className="w-full gap-2 h-11" onClick={() => handleAddToCart(servicio, "servicio")}>
                      <Plus className="h-5 w-5" />
                      Agregar al Carrito
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>

            {servicios.length === 0 && (
              <div className="text-center py-16">
                <Sparkles className="h-20 w-20 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-lg text-muted-foreground">No hay servicios disponibles</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </section>

      <footer className="border-t bg-muted/30 mt-16">
        <div className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>© 2025 El Mundo de las Tutus. Todos los derechos reservados.</p>
        </div>
      </footer>

      <CartSidebar isOpen={cartOpen} onClose={() => setCartOpen(false)} onCheckout={() => setCheckoutOpen(true)} />

      <CheckoutModal
        isOpen={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false)
          updateCartCount()
        }}
      />
    </div>
  )
}
