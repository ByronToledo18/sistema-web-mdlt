"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bell, LogOut, User, Menu } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"

interface HeaderProps {
  userName: string
  userRole: string
  onMenuClick?: () => void
}

interface Ticket {
  id: number
  tipo: string
  prioridad: string
  descripcion: string
  estado: string
  created_at: string
}

export function Header({ userName, userRole, onMenuClick }: HeaderProps) {
  const router = useRouter()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleLabel = (role: string) => {
    const roleLabels: Record<string, string> = {
      administrador: "Administrador",
      vendedor: "Vendedor",
      soporte: "Soporte",
    }
    return roleLabels[role] || role
  }

  useEffect(() => {
    if (userRole === "soporte") {
      fetchTickets()
      // Poll for new tickets every 30 seconds
      const interval = setInterval(fetchTickets, 30000)
      return () => clearInterval(interval)
    }
  }, [userRole])

  const fetchTickets = async () => {
    try {
      console.log("[v0] Fetching tickets from /api/soporte/tickets?estado=pendiente")
      const response = await fetch("/api/soporte/tickets?estado=pendiente")
      console.log("[v0] Tickets response status:", response.status)

      if (response.ok) {
        const data = await response.json()
        console.log("[v0] Tickets data:", data)
        setTickets(data)
        setUnreadCount(data.length)
      } else {
        console.log("[v0] Tickets endpoint returned error:", response.status)
        setTickets([])
        setUnreadCount(0)
      }
    } catch (error) {
      console.log("[v0] Error fetching tickets (table may not exist yet):", error)
      setTickets([])
      setUnreadCount(0)
    }
  }

  const handleLogout = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      })

      if (response.ok) {
        router.push("/login")
      }
    } catch (error) {
      console.error("Error al cerrar sesión:", error)
    }
  }

  const handleNotificationClick = () => {
    router.push("/admin/soporte")
  }

  const getPriorityColor = (prioridad: string) => {
    switch (prioridad) {
      case "alta":
        return "destructive"
      case "media":
        return "default"
      case "baja":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      reseteo_contraseña: "Reseteo de Contraseña",
      soporte_tecnico: "Soporte Técnico",
      consulta: "Consulta",
      otro: "Otro",
    }
    return labels[tipo] || tipo
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6">
      <div className="flex flex-1 items-center justify-between">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex-1" />

        <div className="flex items-center gap-4">
          {userRole === "soporte" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] text-white">
                      {unreadCount}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span className="text-foreground">Notificaciones</span>
                  {unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {unreadCount}
                    </Badge>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {tickets.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No hay notificaciones pendientes</div>
                ) : (
                  <>
                    {tickets.slice(0, 5).map((ticket) => (
                      <DropdownMenuItem key={ticket.id} className="flex flex-col items-start gap-1 p-3">
                        <div className="flex w-full items-center justify-between">
                          <span className="font-medium text-sm text-foreground">{getTipoLabel(ticket.tipo)}</span>
                          <Badge variant={getPriorityColor(ticket.prioridad)} className="text-xs">
                            {ticket.prioridad}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">{ticket.descripcion}</p>
                        <span className="text-xs text-muted-foreground">
                          {new Date(ticket.created_at).toLocaleString("es-ES")}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleNotificationClick} className="justify-center text-primary">
                      Ver todos los tickets
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 hover:bg-accent">
                <Avatar className="h-8 w-8 bg-primary">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials(userName)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium text-foreground">{userName}</span>
                  <span className="text-xs text-muted-foreground group-hover:text-foreground">
                    {getRoleLabel(userRole)}
                  </span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-foreground">Mi Cuenta</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-foreground">
                <User className="mr-2 h-4 w-4" />
                Perfil
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <form onSubmit={handleLogout} className="w-full">
                  <button type="submit" className="flex w-full items-center text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar Sesión
                  </button>
                </form>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
