import "server-only"

// Errores de la integración con Servientrega. El mensaje nunca lleva la URL
// (contiene usuario y contraseña) y ya viene redactado.
export type TipoErrorServientrega =
  // Faltan o son inválidas las variables SERVIENTREGA_*.
  | "no_configurada"
  // No se pudo conectar (DNS, TLS, conexión rechazada o cortada).
  | "red"
  // Servientrega no respondió dentro del tiempo límite.
  | "timeout"
  // Respondió con un status HTTP de error.
  | "http"
  // Respondió 2xx pero con un cuerpo que no se entiende.
  | "respuesta_invalida"
  // Respondió y rechazó la operación (trae su mensaje: "LA GUÍA NO PUEDE SER ANULADA…").
  | "rechazada"

export class ServientregaError extends Error {
  constructor(
    public tipo: TipoErrorServientrega,
    message: string,
    public status?: number,
  ) {
    super(message)
    this.name = "ServientregaError"
  }
}
