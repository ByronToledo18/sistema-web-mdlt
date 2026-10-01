import type { listarRoles, listarUsuarios } from "@/server/services/usuarios"

export type Usuario = Awaited<ReturnType<typeof listarUsuarios>>[number]
export type Rol = Awaited<ReturnType<typeof listarRoles>>[number]
