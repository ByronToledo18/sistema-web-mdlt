import "server-only"

// Integración con la API de Servientrega (Servicli). Ver docs/servientrega-api.md
// y la sección "Integración Servientrega" de ARQUITECTURA.md.
export { crearClienteServientrega, type ClienteServientrega, type GuiaGenerada } from "./cliente"
export { estadoIntegracion, leerConfig, leerRemitente, type EstadoIntegracion, type Remitente } from "./config"
export { ServientregaError, type TipoErrorServientrega } from "./errores"
export type { GuiaInput } from "./guia"
