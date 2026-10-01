// La auditoría vive en server/services/auditoria.ts. Este módulo queda como
// alias para las rutas de autenticación que todavía lo importan.
export {
  registrarAuditoria as createAuditLog,
  type RegistrarAuditoria as CreateAuditLogParams,
} from "@/server/services/auditoria"
