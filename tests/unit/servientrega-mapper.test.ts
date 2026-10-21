import { describe, expect, test } from "vitest"
import { dividirNombre, normalizarTexto, sugerirCiudad } from "@/lib/servientrega"
import { estadoIntegracion, leerConfig, leerRemitente } from "@/server/integraciones/servientrega/config"
import { mapearGuia, type GuiaInput } from "@/server/integraciones/servientrega/guia"

const credenciales = { usuario: "usr_test", password: "clave-test" }

const input: GuiaInput = {
  ciudad_origen_id: 1,
  ciudad_destino_id: 2,
  remitente: {
    identificacion: "0999999999001",
    razon_social: "Tutus S.A.",
    nombre: "Ana",
    apellido: "Pérez",
    direccion: "Av. Uno 1",
    telefono: "0988888888",
  },
  destinatario: {
    identificacion: "0911223344",
    razon_social: "María López",
    nombre: "María",
    apellido: "López",
    direccion: "Calle Dos 2",
    telefono: "0999999999",
  },
  producto_id: 2,
  contenido: "Tutú / prendas",
  piezas: 1,
  peso_kg: 0.5,
  valor_mercancia: 25.456,
  referencia_1: "Pedido TUTU-2026-0001",
  referencia_2: "SER-2026-000001",
}

describe("mapearGuia", () => {
  test("arma el JSON con los nombres de campo de la API", () => {
    expect(mapearGuia(input, credenciales)).toEqual({
      id_tipo_logistica: 1,
      detalle_envio_1: "Pedido TUTU-2026-0001",
      detalle_envio_2: "SER-2026-000001",
      detalle_envio_3: "",
      id_ciudad_origen: 1,
      id_ciudad_destino: 2,
      id_destinatario_ne_cl: "0911223344",
      razon_social_desti_ne: "María López",
      nombre_destinatario_ne: "María",
      apellido_destinatar_ne: "López",
      direccion1_destinat_ne: "Calle Dos 2",
      sector_destinat_ne: "",
      telefono1_destinat_ne: "0999999999",
      telefono2_destinat_ne: "",
      codigo_postal_dest_ne: "",
      id_remitente_cl: "0999999999001",
      razon_social_remite: "Tutus S.A.",
      nombre_remitente: "Ana",
      apellido_remite: "Pérez",
      direccion1_remite: "Av. Uno 1",
      sector_remite: "",
      telefono1_remite: "0988888888",
      telefono2_remite: "",
      codigo_postal_remi: "",
      id_producto: 2,
      contenido: "Tutú / prendas",
      numero_piezas: 1,
      valor_mercancia: 25.46,
      valor_asegurado: 0,
      largo: 0,
      ancho: 0,
      alto: 0,
      peso_fisico: 0.5,
      login_creacion: "usr_test",
      password: "clave-test",
    })
  })

  test("valida el input: producto inexistente, peso 0, piezas fuera de rango, campos vacíos", () => {
    expect(() => mapearGuia({ ...input, producto_id: 5 }, credenciales)).toThrow(/Producto/)
    expect(() => mapearGuia({ ...input, peso_kg: 0 }, credenciales)).toThrow(/peso/)
    expect(() => mapearGuia({ ...input, piezas: 0 }, credenciales)).toThrow(/pieza/)
    expect(() =>
      mapearGuia({ ...input, destinatario: { ...input.destinatario, telefono: "  " } }, credenciales),
    ).toThrow(/Teléfono del destinatario/)
  })
})

describe("config", () => {
  const base = { SERVIENTREGA_AMBIENTE: "qa", SERVIENTREGA_USUARIO: "u", SERVIENTREGA_PASSWORD: "p" }

  test("sin SERVIENTREGA_AMBIENTE la integración queda deshabilitada con un mensaje claro", () => {
    expect(estadoIntegracion({})).toEqual({ habilitada: false, motivo: "Integración con Servientrega no configurada" })
    expect(() => leerConfig({})).toThrow("Integración con Servientrega no configurada")
  })

  test("ambiente inválido o credenciales faltantes: deshabilitada, con el motivo", () => {
    expect(estadoIntegracion({ ...base, SERVIENTREGA_AMBIENTE: "staging" })).toMatchObject({ habilitada: false })
    const sinPassword = estadoIntegracion({ ...base, SERVIENTREGA_PASSWORD: "" })
    expect(sinPassword).toMatchObject({ habilitada: false })
    expect(!sinPassword.habilitada && sinPassword.motivo).toContain("SERVIENTREGA_PASSWORD")
    expect(estadoIntegracion({ ...base, SERVIENTREGA_PASSWORD: "a'b" })).toMatchObject({ habilitada: false })
  })

  test("qa usa la IP con SNI servientrega.com.ec; prod el host público", () => {
    expect(leerConfig(base).endpoints).toEqual({
      api: "https://181.39.87.158:8021",
      documentos: "https://181.39.87.158:7777",
      tlsServername: "servientrega.com.ec",
    })
    expect(leerConfig({ ...base, SERVIENTREGA_AMBIENTE: "PROD" }).endpoints).toEqual({
      api: "https://swservicli.servientrega.com.ec:5052",
      documentos: "https://swservicli.servientrega.com.ec:5001",
      tlsServername: null,
    })
  })

  test("remitente: lista las variables que faltan y valida la ciudad", () => {
    expect(() => leerRemitente({ SERVIENTREGA_REMITENTE_ID: "1" })).toThrow(
      /SERVIENTREGA_REMITENTE_RAZON_SOCIAL, SERVIENTREGA_REMITENTE_NOMBRE.*SERVIENTREGA_REMITENTE_CIUDAD_ID/,
    )
    const completo = {
      SERVIENTREGA_REMITENTE_ID: "0999999999001",
      SERVIENTREGA_REMITENTE_RAZON_SOCIAL: "Tutus",
      SERVIENTREGA_REMITENTE_NOMBRE: "Ana",
      SERVIENTREGA_REMITENTE_APELLIDO: "Pérez",
      SERVIENTREGA_REMITENTE_DIRECCION: "Av. 1",
      SERVIENTREGA_REMITENTE_TELEFONO: "099",
      SERVIENTREGA_REMITENTE_CIUDAD_ID: "2",
    }
    expect(leerRemitente(completo)).toMatchObject({ ciudad_id: 2, sector: "" })
    expect(() => leerRemitente({ ...completo, SERVIENTREGA_REMITENTE_CIUDAD_ID: "quito" })).toThrow(/CIUDAD_ID/)
  })
})

describe("sugerirCiudad", () => {
  const ciudades = [
    { id: 2, nombre: "QUITO (PICHINCHA)" },
    { id: 831, nombre: "QUITO SUR (PICHINCHA)" },
    { id: 452, nombre: "PUERTO QUITO (PICHINCHA)" },
    { id: 1, nombre: "GUAYAQUIL (GUAYAS)" },
    { id: 600, nombre: "10 DE AGOSTO (MANABI)" },
    { id: 49, nombre: "SANTO DOMINGO (SANTO DOMINGO DE LOS TSACHILAS)" },
  ]

  test("por la ciudad del pedido, sin tildes ni mayúsculas", () => {
    expect(sugerirCiudad(ciudades, "quito")).toBe(2)
    expect(sugerirCiudad(ciudades, " Quito Sur ")).toBe(831)
    expect(sugerirCiudad(ciudades, "Guayaquíl, Guayas")).toBe(1)
    expect(sugerirCiudad(ciudades, "QUITO (PICHINCHA)")).toBe(2)
  })

  test("si no hay ciudad, busca en la dirección (gana la coincidencia más larga)", () => {
    expect(sugerirCiudad(ciudades, null, "Av. Amazonas y Colón, Quito")).toBe(2)
    expect(sugerirCiudad(ciudades, "", "Barrio X, Quito Sur")).toBe(831)
    expect(sugerirCiudad(ciudades, "Narnia", "Av. Siempre Viva 123")).toBeNull()
  })

  test("normalizarTexto", () => {
    expect(normalizarTexto("  Ñandú   Cañar ")).toBe("NANDU CANAR")
  })
})

describe("dividirNombre", () => {
  test("separa nombre y apellido (ambos obligatorios en la API)", () => {
    expect(dividirNombre("Ana María Pérez López")).toEqual({ nombre: "Ana María", apellido: "Pérez López" })
    expect(dividirNombre("Ana Pérez")).toEqual({ nombre: "Ana", apellido: "Pérez" })
    expect(dividirNombre("Ana Pérez López")).toEqual({ nombre: "Ana", apellido: "Pérez López" })
    expect(dividirNombre("Cher")).toEqual({ nombre: "Cher", apellido: "Cher" })
  })
})
