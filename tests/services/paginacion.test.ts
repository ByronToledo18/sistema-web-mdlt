import { beforeEach, describe, expect, test } from "vitest"
import { TAMANO_PAGINA } from "@/server/services/_shared"
import { paginaDeClientes } from "@/server/services/clientes"
import { paginaDeMovimientos, registrarMovimiento } from "@/server/services/nomina"
import { paginaDePedidos, crearPedido } from "@/server/services/pedidos"
import { numeroDePagina } from "@/server/validators/common"
import { resetDb } from "../support/db-client"
import { crearCliente } from "../support/fixtures"

beforeEach(resetDb)

describe("numeroDePagina (?page=)", () => {
  test.each([
    [undefined, 1],
    ["", 1],
    ["3", 3],
    ["0", 1],
    ["-2", 1],
    ["1.5", 1],
    ["abc", 1],
    [["4", "9"], 4],
  ])("%j -> %i", (valor, esperado) => {
    expect(numeroDePagina(valor)).toBe(esperado)
  })
})

describe("listados paginados del admin", () => {
  test("pedidos: páginas sin solapes y haySiguiente correcto", async () => {
    const cliente = await crearCliente()
    const total = TAMANO_PAGINA + 3
    for (let i = 0; i < total; i++) await crearPedido(cliente.id)

    const p1 = await paginaDePedidos({}, 1)
    const p2 = await paginaDePedidos({}, 2)
    expect(p1).toMatchObject({ pagina: 1, haySiguiente: true })
    expect(p1.filas).toHaveLength(TAMANO_PAGINA)
    expect(p2).toMatchObject({ pagina: 2, haySiguiente: false })
    expect(p2.filas).toHaveLength(3)

    const ids = [...p1.filas, ...p2.filas].map((p) => p.id)
    expect(new Set(ids).size).toBe(total)
    // Más recientes primero (mismo created_at dentro de la prueba: desempata el id).
    expect(ids).toEqual([...ids].sort((a, b) => b - a))
  })

  test("pedidos: la paginación respeta los filtros", async () => {
    const ana = await crearCliente({ nombre: "Ana Filtro" })
    const otro = await crearCliente({ nombre: "Otro" })
    await crearPedido(ana.id)
    await crearPedido(otro.id)

    const pagina = await paginaDePedidos({ search: "Filtro" }, 1)
    expect(pagina.filas.map((p) => p.cliente_nombre)).toEqual(["Ana Filtro"])
    expect(pagina.haySiguiente).toBe(false)
  })

  test("clientes: una página exacta no anuncia página siguiente", async () => {
    for (let i = 0; i < TAMANO_PAGINA; i++) await crearCliente()
    const pagina = await paginaDeClientes({ mostrarInactivos: false }, 1)
    expect(pagina.filas).toHaveLength(TAMANO_PAGINA)
    expect(pagina.haySiguiente).toBe(false)
    expect((await paginaDeClientes({ mostrarInactivos: false }, 2)).filas).toEqual([])
  })

  test("nómina: pagina más allá de los 100 que mostraba antes", async () => {
    for (let i = 0; i < 101; i++) {
      await registrarMovimiento({
        persona_tipo: "madre",
        concepto: `Mov ${i}`,
        fecha: "2026-09-15",
        tipo: "pago",
        monto: 1,
        pedido_id: null,
      })
    }
    const ultima = Math.ceil(101 / TAMANO_PAGINA)
    const pagina = await paginaDeMovimientos({}, ultima)
    expect(pagina.filas).toHaveLength(101 - (ultima - 1) * TAMANO_PAGINA)
    expect(pagina.haySiguiente).toBe(false)
  })
})
