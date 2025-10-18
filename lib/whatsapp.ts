/**
 * Genera un enlace de WhatsApp con mensaje prellenado
 */
export function generateWhatsAppLink(phoneNumber: string, message: string): string {
  const encodedMessage = encodeURIComponent(message)
  // Formato internacional sin + ni espacios
  const cleanPhone = phoneNumber.replace(/[^0-9]/g, "")
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`
}

/**
 * Genera mensaje de pedido para WhatsApp
 */
export function generateOrderMessage(
  items: {
    nombre: string
    cantidad?: number
    precio?: number
    tipo: "producto" | "servicio"
  }[],
): string {
  let message = "¡Hola! Me gustaría hacer un pedido:\n\n"

  items.forEach((item, index) => {
    message += `${index + 1}. ${item.nombre}`
    if (item.cantidad) {
      message += ` (x${item.cantidad})`
    }
    if (item.precio) {
      message += ` - $${item.precio.toLocaleString("es-CO")}`
    }
    message += "\n"
  })

  message += "\n¿Podrían darme más información?"

  return message
}
