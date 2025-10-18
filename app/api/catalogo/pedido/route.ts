import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { generatePedidoCodigo } from "@/lib/pedidos"

export async function POST(request: NextRequest) {
  try {
    const { cliente, items, metodoEntrega, direccionEnvio, ciudadEnvio, costoEnvio } = await request.json()

    if (!cliente.nombre || !cliente.cedula || !cliente.telefono || !cliente.email) {
      return NextResponse.json({ error: "Nombre, cédula, teléfono y email son requeridos" }, { status: 400 })
    }

    if (metodoEntrega === "envio" && !cliente.direccion) {
      return NextResponse.json({ error: "La dirección es requerida para envío a domicilio" }, { status: 400 })
    }

    if (metodoEntrega === "envio" && !ciudadEnvio) {
      return NextResponse.json({ error: "La ciudad de envío es requerida" }, { status: 400 })
    }

    const cedulaExistente = await sql`
      SELECT id FROM clientes WHERE cedula = ${cliente.cedula} LIMIT 1
    `

    let clienteId: number

    if (cedulaExistente.length > 0) {
      clienteId = cedulaExistente[0].id

      await sql`
        UPDATE clientes
        SET nombre = ${cliente.nombre},
            telefono = ${cliente.telefono},
            email = ${cliente.email || null},
            direccion = ${cliente.direccion || null},
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ${clienteId}
      `
    } else {
      const nuevoCliente = await sql`
        INSERT INTO clientes (nombre, cedula, telefono, email, direccion, activo)
        VALUES (
          ${cliente.nombre},
          ${cliente.cedula},
          ${cliente.telefono},
          ${cliente.email || null},
          ${cliente.direccion || null},
          true
        )
        RETURNING id
      `
      clienteId = nuevoCliente[0].id
    }

    const codigo = await generatePedidoCodigo()

    const subtotal = items.reduce((sum: number, item: any) => sum + item.precio * item.cantidad, 0)
    const total = metodoEntrega === "envio" ? subtotal + (costoEnvio || 0) : subtotal

    const metodoEntregaTexto = metodoEntrega === "retiro" ? "Retiro en Tienda" : "Envío a Domicilio"
    let notas = `Método de entrega: ${metodoEntregaTexto}`

    if (metodoEntrega === "envio" && ciudadEnvio) {
      notas += `\nCiudad de envío: ${ciudadEnvio}`
    }

    if (metodoEntrega === "envio" && direccionEnvio && direccionEnvio !== cliente.direccion) {
      notas += `\nDirección de envío: ${direccionEnvio}`
    }

    const pedido = await sql`
      INSERT INTO pedidos (codigo, cliente_id, estado, total, notas, costo_envio, ciudad_envio)
      VALUES (
        ${codigo}, 
        ${clienteId}, 
        'recibido', 
        ${total}, 
        ${notas},
        ${metodoEntrega === "envio" ? costoEnvio || 0 : 0},
        ${metodoEntrega === "envio" ? ciudadEnvio : null}
      )
      RETURNING *
    `

    const pedidoId = pedido[0].id

    for (const item of items) {
      const subtotal = item.precio * item.cantidad

      if (item.tipo === "producto") {
        const stockCheck = await sql`
          SELECT stock FROM productos WHERE id = ${item.id}
        `
        if (stockCheck.length === 0 || stockCheck[0].stock < item.cantidad) {
          throw new Error(`Stock insuficiente para ${item.nombre}`)
        }

        await sql`
          UPDATE productos
          SET stock = stock - ${item.cantidad}
          WHERE id = ${item.id}
        `
      }

      await sql`
        INSERT INTO pedido_items (
          pedido_id, item_tipo, item_id, descripcion, cantidad, precio_unitario, subtotal
        )
        VALUES (
          ${pedidoId},
          ${item.tipo},
          ${item.id},
          ${item.nombre},
          ${item.cantidad},
          ${item.precio},
          ${subtotal}
        )
      `
    }

    if (metodoEntrega === "envio" && costoEnvio > 0) {
      const envioServicio = await sql`
        SELECT id FROM servicios WHERE nombre = 'Envío' LIMIT 1
      `

      if (envioServicio.length > 0) {
        await sql`
          INSERT INTO pedido_items (
            pedido_id, item_tipo, item_id, descripcion, cantidad, precio_unitario, subtotal
          )
          VALUES (
            ${pedidoId},
            'servicio',
            ${envioServicio[0].id},
            'Envío',
            1,
            ${costoEnvio},
            ${costoEnvio}
          )
        `
      }
    }

    return NextResponse.json({
      success: true,
      pedido: {
        id: pedidoId,
        codigo: pedido[0].codigo,
        total: pedido[0].total,
      },
    })
  } catch (error: any) {
    console.error("[v0] Create catalog order error:", error)
    return NextResponse.json({ error: error.message || "Error al crear el pedido" }, { status: 500 })
  }
}
