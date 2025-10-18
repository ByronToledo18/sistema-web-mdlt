"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

export default function SetupAdminPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success: boolean; message: string; credentials?: any } | null>(null)

  const setupAdmin = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch("/api/setup-admin", {
        method: "POST",
      })

      const data = await response.json()
      setResult(data)
    } catch (error) {
      setResult({
        success: false,
        message: "Error al configurar los usuarios",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Configuración de Usuarios</CardTitle>
          <CardDescription>Crea o actualiza los usuarios del sistema (Admin y Soporte)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={setupAdmin} disabled={loading} className="w-full" size="lg">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Configurando...
              </>
            ) : (
              "Configurar Usuarios"
            )}
          </Button>

          {result && (
            <Alert variant={result.success ? "default" : "destructive"}>
              {result.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium">{result.message}</p>
                  {result.credentials && Array.isArray(result.credentials) && (
                    <div className="mt-3 space-y-3">
                      {result.credentials.map((cred: any, index: number) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-md text-sm space-y-1">
                          <p className="font-semibold text-gray-700">
                            {cred.role === "administrador" ? "Administrador" : "Soporte Técnico"}
                          </p>
                          <p>
                            <strong>Email:</strong> {cred.email}
                          </p>
                          <p>
                            <strong>Contraseña:</strong> {cred.password}
                          </p>
                        </div>
                      ))}
                      <p className="text-xs text-gray-600 mt-2">
                        Ahora puedes iniciar sesión en{" "}
                        <a href="/login" className="underline">
                          /login
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="text-sm text-gray-600 space-y-3">
            <div>
              <p className="font-semibold">Administrador:</p>
              <p>Email: admin@elmundodelastutus.com</p>
              <p>Contraseña: Admin123!</p>
            </div>
            <div>
              <p className="font-semibold">Soporte Técnico:</p>
              <p>Email: soporte@elmundodelastutus.com</p>
              <p>Contraseña: Soporte123!</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
