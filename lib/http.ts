import { NextResponse } from "next/server"

// Error con un mensaje pensado para el cliente. Cualquier otro error que
// llegue a apiError() se considera interno y su mensaje nunca se expone.
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = "HttpError"
  }
}

// Convierte un error capturado en la respuesta HTTP adecuada.
// - HttpError (incluye los 401/403 de withAuth/assertCan): se responde con su status y mensaje.
// - Cualquier otro: 500 con un mensaje genérico. El detalle (mensajes de
//   Postgres, nombres de tablas, stack) se queda en el log del servidor; el
//   catch de cada ruta ya lo registra antes de llamar a esta función.
export function apiError(error: unknown, fallbackMsg = "Error en el servidor") {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return NextResponse.json({ error: fallbackMsg }, { status: 500 })
}
