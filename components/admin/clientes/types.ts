import type { listarClientes } from "@/server/services/clientes"

export type Cliente = Awaited<ReturnType<typeof listarClientes>>[number]
