import "server-only"

import { revalidatePath } from "next/cache"

// Invalida la página ISR del catálogo público. Se llama desde route handlers y
// Server Actions (no desde server/services, que también corren en los tests,
// fuera de un request de Next) después de crear, editar, activar/inactivar o
// eliminar productos y servicios.
export function revalidarCatalogo() {
  revalidatePath("/catalogo")
}
