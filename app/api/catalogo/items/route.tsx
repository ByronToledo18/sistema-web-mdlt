import { type NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/db"

// GET - Listar productos y servicios activos para el catálogo público
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get("search") || ""

    let productosQuery = `
      SELECT id, sku, nombre, precio, stock, imagen_url, 'producto' as tipo
      FROM productos 
      WHERE activo = true
    `
    const productosParams: any[] = []

    if (search) {
      productosQuery += ` AND (nombre ILIKE $1 OR sku ILIKE $1)`
      productosParams.push(`%${search}%`)
    }

    productosQuery += ` ORDER BY nombre ASC`

    let serviciosQuery = `
      SELECT id, nombre, unidad, precio_base as precio, variable, imagen_url, 'servicio' as tipo
      FROM servicios 
      WHERE activo = true
    `
    const serviciosParams: any[] = []

    serviciosQuery += ` AND nombre != 'Envío'`

    if (search) {
      serviciosQuery += ` AND nombre ILIKE $${serviciosParams.length + 1}`
      serviciosParams.push(`%${search}%`)
    }

    serviciosQuery += ` ORDER BY nombre ASC`

    const [productosRaw, serviciosRaw] = await Promise.all([
      executeQuery(productosQuery, productosParams),
      executeQuery(serviciosQuery, serviciosParams),
    ])

    const productos = productosRaw.map((p: any) => ({
      ...p,
      precio: Number.parseFloat(p.precio),
      stock: Number.parseInt(p.stock),
    }))

    const servicios = serviciosRaw.map((s: any) => ({
      ...s,
      precio: Number.parseFloat(s.precio),
    }))

    return NextResponse.json({
      productos,
      servicios,
      total: productos.length + servicios.length,
    })
  } catch (error: any) {
    console.error("[v0] Get catalog items error:", error)
    return NextResponse.json({ error: "Error al obtener items del catálogo" }, { status: 500 })
  }
}
