"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

// Solo se muestra si falla el layout raíz; reemplaza todo el documento.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Algo salió mal</h1>
          <p style={{ color: "#666", marginBottom: 16 }}>Ocurrió un error inesperado. Intenta de nuevo.</p>
          <button onClick={reset} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #ccc", cursor: "pointer" }}>
            Reintentar
          </button>
        </div>
      </body>
    </html>
  )
}
