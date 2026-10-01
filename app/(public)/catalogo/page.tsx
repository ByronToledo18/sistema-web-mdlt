import { CatalogoView } from "@/components/catalog/catalogo-view"
import { itemsDelCatalogo } from "@/server/services/catalogo"

// ISR: la grilla se sirve desde caché y se regenera como máximo cada 60 s, para
// que el stock ("¡Últimas N!", "Agotado") no quede muy atrás. Las ediciones de
// productos y servicios la invalidan al instante con revalidarCatalogo().
// El stock real se vuelve a validar de forma atómica al crear el pedido.
export const revalidate = 60

export default async function CatalogoPage() {
  const { productos, servicios } = await itemsDelCatalogo()
  return <CatalogoView productos={productos} servicios={servicios} />
}
