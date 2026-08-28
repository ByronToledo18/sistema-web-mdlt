import { type NextRequest, NextResponse } from "next/server"
import { sql } from "@/lib/db"
import { generatePedidoCodigo } from "@/lib/pedidos"
import { getClienteFromToken } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const clienteToken = await getClienteFromToken()
    if (!clienteToken) {
      return NextResponse.json({ error: "Debes iniciar sesión para realizar un pedido" }, { status: 401 })
    }

    const { cliente, items, metodoEntrega, direccionEnvio, ciudadEnvio } = await request.json()

    if (!cliente?.nombre || !cliente?.cedula || !cliente?.telefono) {
      return NextResponse.json({ error: "Nombre, cédula y teléfono son requeridos" }, { status: 400 })
    }

    if (metodoEntrega === "envio" && !cliente.direccion) {
      return NextResponse.json({ error: "La dirección es requerida para envío a domicilio" }, { status: 400 })
    }

    if (metodoEntrega === "envio" && !ciudadEnvio) {
      return NextResponse.json({ error: "La ciudad de envío es requerida" }, { status: 400 })
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "El pedido debe tener al menos un ítem" }, { status: 400 })
    }

    // El pedido siempre pertenece al cliente autenticado - nunca se busca/crea
    // por cédula, para no permitir que un cliente logueado edite o secuestre
    // la fila de otro cliente enviando una cédula ajena en el body.
    const clienteId = clienteToken.id

    await sql`
      UPDATE clientes
      SET nombre = ${cliente.nombre},
          cedula = COALESCE(cedula, ${cliente.cedula}),
          telefono = ${cliente.telefono},
          direccion = ${cliente.direccion || null},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${clienteId}
    `

    // Recalcular cada item contra el precio real en BD - nunca confiar en el
    // precio que manda el cliente en el body (hallazgo de seguridad A).
    const itemsConPrecioReal: { tipo: string; id: number; nombre: string; cantidad: number; precio: number }[] = []
    for (const item of items) {
      const cantidad = Number(item.cantidad)
      if (!item.id || !item.tipo || !Number.isFinite(cantidad) || cantidad <= 0) {
        return NextResponse.json({ error: "Ítem de pedido inválido" }, { status: 400 })
      }

      if (item.tipo === "producto") {
        const productoResult = await sql`
          SELECT nombre, precio, stock FROM productos WHERE id = ${item.id} AND activo = true
        `
        if (productoResult.length === 0) {
          return NextResponse.json({ error: `Producto no encontrado o inactivo` }, { status: 400 })
        }
        if (productoResult[0].stock < cantidad) {
          return NextResponse.json({ error: `Stock insuficiente para ${productoResult[0].nombre}` }, { status: 400 })
        }
        itemsConPrecioReal.push({
          tipo: "producto",
          id: item.id,
          nombre: productoResult[0].nombre,
          cantidad,
          precio: Number.parseFloat(productoResult[0].precio),
        })
      } else if (item.tipo === "servicio") {
        const servicioResult = await sql`
          SELECT nombre, precio_base FROM servicios WHERE id = ${item.id} AND activo = true
        `
        if (servicioResult.length === 0) {
          return NextResponse.json({ error: `Servicio no encontrado o inactivo` }, { status: 400 })
        }
        itemsConPrecioReal.push({
          tipo: "servicio",
          id: item.id,
          nombre: servicioResult[0].nombre,
          cantidad,
          precio: Number.parseFloat(servicioResult[0].precio_base),
        })
      } else {
        return NextResponse.json({ error: "Tipo de ítem inválido" }, { status: 400 })
      }
    }

    // Recalcular el costo de envío contra tarifas_envio - nunca confiar en el
    // costoEnvio que manda el cliente en el body.
    let costoEnvioReal = 0
    if (metodoEntrega === "envio") {
      const tarifaResult = await sql`
        SELECT costo FROM tarifas_envio WHERE ciudad = ${ciudadEnvio} AND activo = true LIMIT 1
      `
      if (tarifaResult.length === 0) {
        return NextResponse.json({ error: "No hay tarifa de envío configurada para esa ciudad" }, { status: 400 })
      }
      costoEnvioReal = Number.parseFloat(tarifaResult[0].costo)
    }

    const codigo = await generatePedidoCodigo()

    const subtotal = itemsConPrecioReal.reduce((sum, item) => sum + item.precio * item.cantidad, 0)
    const total = metodoEntrega === "envio" ? subtotal + costoEnvioReal : subtotal

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
        ${costoEnvioReal},
        ${metodoEntrega === "envio" ? ciudadEnvio : null}
      )
      RETURNING *
    `

    const pedidoId = pedido[0].id

    for (const item of itemsConPrecioReal) {
      const itemSubtotal = item.precio * item.cantidad

      if (item.tipo === "producto") {
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
          ${itemSubtotal}
        )
      `
    }

    if (metodoEntrega === "envio" && costoEnvioReal > 0) {
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
            ${costoEnvioReal},
            ${costoEnvioReal}
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
