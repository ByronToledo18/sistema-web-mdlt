import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { generateWhatsAppLink } from "@/lib/whatsapp"
import crypto from "crypto"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "El email es requerido" }, { status: 400 })
    }

    // Buscar cliente
    const result = await sql`
      SELECT id, nombre, email, telefono
      FROM clientes
      WHERE email = ${email}
    `

    if (result.length === 0) {
      // Por seguridad, no revelamos si el email existe o no
      return NextResponse.json({ success: true })
    }

    const cliente = result[0]

    // Generar token de reseteo (aleatoriedad criptográfica, no adivinable)
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hora

    // Guardar token en la base de datos
    await sql`
      UPDATE clientes
      SET reset_token = ${resetToken}, reset_token_expiry = ${resetTokenExpiry}
      WHERE id = ${cliente.id}
    `

    // No hay servicio de email configurado en este proyecto. El canal real
    // del negocio con sus clientes es WhatsApp (ver lib/whatsapp.ts) - se
    // crea un ticket de soporte con un enlace de WhatsApp pre-armado para
    // que el equipo lo reenvíe al cliente. El link de reseteo NUNCA se
    // loguea ni se devuelve en la respuesta de este endpoint - solo vive en
    // el ticket, visible únicamente para soporte/administrador.
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin}/portal/reset-password?token=${resetToken}`
    const mensajeWhatsApp = `Hola ${cliente.nombre}, aquí está tu enlace para restablecer tu contraseña (válido por 1 hora): ${resetUrl}`
    const whatsappLink = cliente.telefono ? generateWhatsAppLink(cliente.telefono, mensajeWhatsApp) : null

    await sql`
      INSERT INTO tickets (tipo, prioridad, descripcion, estado, email_contacto)
      VALUES (
        'reseteo_contraseña',
        'alta',
        ${`Solicitud de reseteo de contraseña para: ${cliente.nombre} (${cliente.email}).\n\n${
          whatsappLink
            ? `Reenviar por WhatsApp: ${whatsappLink}`
            : `El cliente no tiene teléfono registrado. Enlace de reseteo: ${resetUrl}`
        }`},
        'pendiente',
        ${cliente.email}
      )
    `

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Password recovery error:", error)
    return NextResponse.json({ error: error.message || "Error al procesar solicitud" }, { status: 500 })
  }
}
