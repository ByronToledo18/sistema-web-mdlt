import { FileText, Shield, Users } from "lucide-react"
import { BackButton } from "@/components/ui/back-button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TIME_ZONE } from "@/components/admin/format"
import { CrearUsuarioButton } from "@/components/admin/soporte/crear-usuario-button"
import { UsuariosTable } from "@/components/admin/soporte/usuarios-table"
import { can } from "@/server/auth/guard"
import { requirePermission } from "@/server/auth/session"
import { listarAuditoria } from "@/server/services/auditoria"
import { listarRoles, listarUsuarios } from "@/server/services/usuarios"

const AUDITORIA_LIMIT = 50

export default async function SoportePage() {
  const user = await requirePermission("sistema")
  const canReadUsuarios = can(user, "usuarios", "read")
  const canReadAuditoria = can(user, "auditoria", "read")

  const [usuarios, roles, auditLogs] = await Promise.all([
    canReadUsuarios ? listarUsuarios() : [],
    canReadUsuarios ? listarRoles() : [],
    canReadAuditoria ? listarAuditoria({ limit: AUDITORIA_LIMIT, offset: 0 }) : [],
  ])

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton href="/admin/dashboard" />
          <div>
            <h1 className="text-3xl font-bold">Panel de Soporte Técnico</h1>
            <p className="text-muted-foreground">Gestión de usuarios, roles y auditoría del sistema</p>
          </div>
        </div>
        {can(user, "usuarios", "create") && <CrearUsuarioButton roles={roles} />}
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuarios Totales</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{usuarios.length}</div>
            <p className="text-xs text-muted-foreground">{usuarios.filter((u) => u.activo).length} activos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Roles del Sistema</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
            <p className="text-xs text-muted-foreground">Perfiles configurados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acciones Registradas</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{auditLogs.length}</div>
            <p className="text-xs text-muted-foreground">Últimas {AUDITORIA_LIMIT} acciones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sistema</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Operativo</div>
            <p className="text-xs text-muted-foreground">Todos los servicios activos</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Gestión de Usuarios</CardTitle>
          <CardDescription>Administra usuarios, resetea contraseñas, cambia roles y controla accesos</CardDescription>
        </CardHeader>
        <CardContent>
          <UsuariosTable usuarios={usuarios} roles={roles} canUpdate={can(user, "usuarios", "update")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Log de Auditoría</CardTitle>
          <CardDescription>Registro de acciones importantes del sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Módulo</TableHead>
                <TableHead>Acción</TableHead>
                <TableHead>Descripción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {log.fecha ? new Date(log.fecha).toLocaleString("es-ES", { timeZone: TIME_ZONE }) : ""}
                  </TableCell>
                  <TableCell className="text-sm">{log.usuario_nombre || "Sistema"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.modulo}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge>{log.accion}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{log.descripcion}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
