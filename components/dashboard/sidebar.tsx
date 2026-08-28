"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  CreditCard,
  Truck,
  DollarSign,
  Shield,
  X,
  Building2,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface SidebarProps {
  userRole: string
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ userRole, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()

  const navItems = [
    {
      title: "Dashboard",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
      roles: ["administrador", "asistente", "soporte"],
    },
    {
      title: "Pedidos",
      href: "/admin/pedidos",
      icon: ShoppingCart,
      roles: ["administrador", "asistente"],
    },
    {
      title: "Clientes",
      href: "/admin/clientes",
      icon: Users,
      roles: ["administrador", "asistente"],
    },
    {
      title: "Inventario",
      href: "/admin/inventario",
      icon: Package,
      roles: ["administrador", "asistente"],
    },
    {
      title: "Cobros",
      href: "/admin/pagos",
      icon: CreditCard,
      roles: ["administrador"],
    },
    {
      title: "Envíos",
      href: "/admin/envios",
      icon: Truck,
      roles: ["administrador", "asistente"],
    },
    {
      title: "Proveedores",
      href: "/admin/proveedores",
      icon: Building2,
      roles: ["administrador"],
    },
    {
      title: "Nómina",
      href: "/admin/nomina",
      icon: DollarSign,
      roles: ["administrador"],
    },
    {
      title: "Soporte",
      href: "/admin/soporte",
      icon: Shield,
      roles: ["soporte"],
    },
  ]

  const filteredNavItems = navItems.filter((item) => item.roles.includes(userRole))

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-50 h-screen w-64 border-r bg-card transition-transform duration-300 ease-in-out",
        "lg:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b px-6">
          <h2 className="text-xl font-bold text-primary">El Mundo de las Tutus</h2>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-4">
          {filteredNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onClose?.()}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.title}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t p-4">
          <p className="text-xs text-muted-foreground">© 2025 El Mundo de las Tutus</p>
        </div>
      </div>
    </aside>
  )
}
