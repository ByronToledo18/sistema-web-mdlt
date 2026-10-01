// Colores y etiquetas del estado de un pedido (listado y detalle).
export const estadoColors: Record<string, string> = {
  recibido: "bg-blue-500",
  en_proceso: "bg-yellow-500",
  terminado: "bg-green-500",
  anulado: "bg-red-500",
  entregado: "bg-purple-500",
}

export const estadoLabels: Record<string, string> = {
  recibido: "Recibido",
  en_proceso: "En Proceso",
  terminado: "Terminado",
  anulado: "Anulado",
  entregado: "Entregado",
}
