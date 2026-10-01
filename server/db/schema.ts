// Esquema de la base de datos (Neon Postgres) para Drizzle.
//
// Generado con `drizzle-kit pull` contra la base real y ajustado a mano:
// - Las propiedades van en snake_case, igual que las columnas, para que las
//   filas que devuelven los servicios tengan la misma forma que el JSON que
//   ya consume la UI (`cliente_id`, `precio_unitario`, ...).
// - `numeric` se mantiene como string (el driver lo devuelve así y la UI hace
//   parseFloat); los `timestamp` como Date y las `date` como "YYYY-MM-DD".
// - Se dejaron fuera las tablas legacy sin uso (facturas_proveedor,
//   factura_items, pagos_proveedor, playing_with_neon), la vista audit_logs y
//   las secuencias por año (pedido_codigo_seq_tutu_YYYY, ...), que se crean en
//   tiempo de ejecución desde server/services/secuencias.ts.
//   Ver docs/database-schema.md.

import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core"

const money = (name: string) => numeric(name, { precision: 10, scale: 2 })
const ts = (name: string) => timestamp(name, { mode: "date" })
const createdAt = () => ts("created_at").default(sql`CURRENT_TIMESTAMP`)
const updatedAt = () => ts("updated_at").default(sql`CURRENT_TIMESTAMP`)

export const PEDIDO_ESTADOS = ["recibido", "en_proceso", "terminado", "anulado", "entregado"] as const
export const ENVIO_ESTADOS = ["pendiente", "en_proceso", "terminado"] as const
export const ITEM_TIPOS = ["producto", "servicio"] as const
export const NOMINA_TIPOS = ["pago", "deduccion", "bono"] as const

// ---------------------------------------------------------------------------
// Usuarios internos y auditoría
// ---------------------------------------------------------------------------

export const roles = pgTable(
  "roles",
  {
    id: serial("id").primaryKey(),
    nombre: varchar("nombre", { length: 50 }).notNull(),
  },
  (t) => [unique("roles_nombre_key").on(t.nombre)],
)

export const usuarios = pgTable(
  "usuarios",
  {
    id: serial("id").primaryKey(),
    rol_id: integer("rol_id").notNull(),
    nombre: varchar("nombre", { length: 100 }).notNull(),
    email: varchar("email", { length: 100 }).notNull(),
    hash_password: varchar("hash_password", { length: 255 }).notNull(),
    activo: boolean("activo").default(true),
    // Se incrementa al desactivar, cambiar de rol o resetear la contraseña:
    // invalida los JWT emitidos antes (ver lib/auth.ts).
    token_version: integer("token_version").notNull().default(0),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    index("idx_usuarios_email").on(t.email),
    foreignKey({ columns: [t.rol_id], foreignColumns: [roles.id], name: "usuarios_rol_id_fkey" }),
    unique("usuarios_email_key").on(t.email),
  ],
)

export const auditoria = pgTable(
  "auditoria",
  {
    id: serial("id").primaryKey(),
    usuario_id: integer("usuario_id"),
    accion: varchar("accion", { length: 100 }).notNull(),
    modulo: varchar("modulo", { length: 50 }).notNull(),
    descripcion: text("descripcion"),
    ip_address: varchar("ip_address", { length: 45 }),
    user_agent: text("user_agent"),
    metadata: jsonb("metadata"),
    fecha: ts("fecha").default(sql`CURRENT_TIMESTAMP`),
  },
  (t) => [
    index("idx_auditoria_accion").on(t.accion),
    index("idx_auditoria_fecha").on(t.fecha.desc()),
    index("idx_auditoria_modulo").on(t.modulo),
    index("idx_auditoria_usuario").on(t.usuario_id),
    foreignKey({ columns: [t.usuario_id], foreignColumns: [usuarios.id], name: "auditoria_usuario_id_fkey" }).onDelete(
      "set null",
    ),
  ],
)

export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    tipo: varchar("tipo", { length: 50 }).notNull(),
    prioridad: varchar("prioridad", { length: 20 }).notNull(),
    descripcion: text("descripcion").notNull(),
    email_contacto: varchar("email_contacto", { length: 255 }),
    estado: varchar("estado", { length: 20 }).default("pendiente"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [index("idx_tickets_created_at").on(t.created_at.desc()), index("idx_tickets_estado").on(t.estado)],
)

// ---------------------------------------------------------------------------
// Clientes, catálogo y pedidos
// ---------------------------------------------------------------------------

export const clientes = pgTable(
  "clientes",
  {
    id: serial("id").primaryKey(),
    nombre: varchar("nombre", { length: 100 }).notNull(),
    telefono: varchar("telefono", { length: 20 }),
    email: varchar("email", { length: 100 }),
    direccion: text("direccion"),
    notas: text("notas"),
    created_at: createdAt(),
    updated_at: updatedAt(),
    cedula: varchar("cedula", { length: 20 }),
    activo: boolean("activo").default(true),
    hash_password: text("hash_password"),
    ultimo_acceso: ts("ultimo_acceso"),
    reset_token: text("reset_token"),
    reset_token_expiry: ts("reset_token_expiry"),
    // Columna huérfana: reemplazada por debe_cambiar_password, no se usa.
    requiere_cambio_password: boolean("requiere_cambio_password").default(false),
    debe_cambiar_password: boolean("debe_cambiar_password").default(false),
    // Igual que usuarios.token_version, para las sesiones del portal.
    token_version: integer("token_version").notNull().default(0),
  },
  (t) => [
    index("idx_clientes_activo").on(t.activo),
    index("idx_clientes_cedula").on(t.cedula),
    uniqueIndex("idx_clientes_cedula_unique")
      .on(t.cedula)
      .where(sql`(cedula IS NOT NULL)`),
    index("idx_clientes_email").on(t.email),
    uniqueIndex("idx_clientes_email_unique")
      .on(t.email)
      .where(sql`(email IS NOT NULL)`),
    unique("clientes_cedula_key").on(t.cedula),
  ],
)

export const productos = pgTable(
  "productos",
  {
    id: serial("id").primaryKey(),
    sku: varchar("sku", { length: 50 }),
    nombre: varchar("nombre", { length: 100 }).notNull(),
    precio: money("precio").notNull(),
    stock: integer("stock").default(0),
    activo: boolean("activo").default(true),
    created_at: createdAt(),
    updated_at: updatedAt(),
    imagen_url: text("imagen_url"),
  },
  (t) => [unique("productos_sku_key").on(t.sku)],
)

export const servicios = pgTable("servicios", {
  id: serial("id").primaryKey(),
  nombre: varchar("nombre", { length: 100 }).notNull(),
  unidad: varchar("unidad", { length: 50 }),
  precio_base: money("precio_base").notNull(),
  variable: boolean("variable").default(false),
  activo: boolean("activo").default(true),
  created_at: createdAt(),
  updated_at: updatedAt(),
  imagen_url: text("imagen_url"),
})

export const tarifasEnvio = pgTable(
  "tarifas_envio",
  {
    id: serial("id").primaryKey(),
    ciudad: varchar("ciudad", { length: 100 }).notNull(),
    provincia: varchar("provincia", { length: 100 }),
    costo: money("costo").notNull(),
    activo: boolean("activo").default(true),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [unique("tarifas_envio_ciudad_key").on(t.ciudad)],
)

export const pedidos = pgTable(
  "pedidos",
  {
    id: serial("id").primaryKey(),
    codigo: varchar("codigo", { length: 50 }).notNull(),
    cliente_id: integer("cliente_id").notNull(),
    estado: varchar("estado", { length: 20, enum: PEDIDO_ESTADOS }).default("recibido"),
    fecha_creacion: ts("fecha_creacion").default(sql`CURRENT_TIMESTAMP`),
    total: money("total").default("0"),
    created_at: createdAt(),
    updated_at: updatedAt(),
    notas: text("notas"),
    costo_envio: money("costo_envio").default("0"),
    ciudad_envio: varchar("ciudad_envio", { length: 100 }),
    coordenadas_envio: jsonb("coordenadas_envio"),
  },
  (t) => [
    index("idx_pedidos_cliente").on(t.cliente_id),
    index("idx_pedidos_codigo").on(t.codigo),
    index("idx_pedidos_estado").on(t.estado),
    foreignKey({ columns: [t.cliente_id], foreignColumns: [clientes.id], name: "pedidos_cliente_id_fkey" }),
    unique("pedidos_codigo_key").on(t.codigo),
    check(
      "pedidos_estado_check",
      sql`(estado)::text = ANY ((ARRAY['recibido'::character varying, 'en_proceso'::character varying, 'terminado'::character varying, 'anulado'::character varying, 'entregado'::character varying])::text[])`,
    ),
  ],
)

// item_id apunta a productos o a servicios según item_tipo. No es una FK real.
export const pedidoItems = pgTable(
  "pedido_items",
  {
    id: serial("id").primaryKey(),
    pedido_id: integer("pedido_id").notNull(),
    item_tipo: varchar("item_tipo", { length: 20, enum: ITEM_TIPOS }).notNull(),
    item_id: integer("item_id").notNull(),
    descripcion: text("descripcion"),
    cantidad: money("cantidad").notNull(),
    precio_unitario: money("precio_unitario").notNull(),
    subtotal: money("subtotal").notNull(),
    created_at: createdAt(),
  },
  (t) => [
    index("idx_pedido_items_pedido").on(t.pedido_id),
    foreignKey({ columns: [t.pedido_id], foreignColumns: [pedidos.id], name: "pedido_items_pedido_id_fkey" }).onDelete(
      "cascade",
    ),
    check(
      "pedido_items_item_tipo_check",
      sql`(item_tipo)::text = ANY ((ARRAY['producto'::character varying, 'servicio'::character varying])::text[])`,
    ),
  ],
)

export const pedidoFacturas = pgTable(
  "pedido_facturas",
  {
    id: serial("id").primaryKey(),
    pedido_id: integer("pedido_id").notNull(),
    numero_factura: varchar("numero_factura", { length: 50 }).notNull(),
    fecha_emision: date("fecha_emision")
      .default(sql`CURRENT_DATE`)
      .notNull(),
    subtotal: money("subtotal").notNull(),
    iva: money("iva").notNull(),
    total: money("total").notNull(),
    estado: varchar("estado", { length: 20 }).default("emitida").notNull(),
    created_at: createdAt(),
  },
  (t) => [
    index("idx_pedido_facturas_pedido").on(t.pedido_id),
    foreignKey({ columns: [t.pedido_id], foreignColumns: [pedidos.id], name: "pedido_facturas_pedido_id_fkey" }),
    unique("pedido_facturas_pedido_id_key").on(t.pedido_id),
    unique("pedido_facturas_numero_factura_key").on(t.numero_factura),
    check(
      "pedido_facturas_estado_check",
      sql`(estado)::text = ANY ((ARRAY['emitida'::character varying, 'anulada'::character varying])::text[])`,
    ),
  ],
)

export const pagos = pgTable(
  "pagos",
  {
    id: serial("id").primaryKey(),
    pedido_id: integer("pedido_id").notNull(),
    fecha: ts("fecha").default(sql`CURRENT_TIMESTAMP`),
    monto: money("monto").notNull(),
    metodo: varchar("metodo", { length: 50 }),
    referencia: varchar("referencia", { length: 100 }),
    observacion: text("observacion"),
    created_at: createdAt(),
  },
  (t) => [
    index("idx_pagos_pedido").on(t.pedido_id),
    foreignKey({ columns: [t.pedido_id], foreignColumns: [pedidos.id], name: "pagos_pedido_id_fkey" }),
  ],
)

export const disenosPersonalizados = pgTable(
  "disenos_personalizados",
  {
    id: serial("id").primaryKey(),
    cliente_id: integer("cliente_id").notNull(),
    descripcion: text("descripcion").notNull(),
    imagen_url: text("imagen_url").notNull(),
    estado: varchar("estado", { length: 20 }).default("generado").notNull(),
    pedido_id: integer("pedido_id"),
    created_at: createdAt(),
  },
  (t) => [
    index("idx_disenos_personalizados_cliente").on(t.cliente_id),
    foreignKey({
      columns: [t.cliente_id],
      foreignColumns: [clientes.id],
      name: "disenos_personalizados_cliente_id_fkey",
    }),
    foreignKey({
      columns: [t.pedido_id],
      foreignColumns: [pedidos.id],
      name: "disenos_personalizados_pedido_id_fkey",
    }),
    check(
      "disenos_personalizados_estado_check",
      sql`(estado)::text = ANY ((ARRAY['generado'::character varying, 'en_pedido'::character varying, 'descartado'::character varying])::text[])`,
    ),
  ],
)

// ---------------------------------------------------------------------------
// Envíos y cuenta Servientrega
// ---------------------------------------------------------------------------

export const envios = pgTable(
  "envios",
  {
    id: serial("id").primaryKey(),
    pedido_id: integer("pedido_id").notNull(),
    guia: varchar("guia", { length: 100 }),
    fecha_envio: ts("fecha_envio"),
    estado: varchar("estado", { length: 50, enum: ENVIO_ESTADOS }),
    costo: money("costo"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    index("idx_envios_pedido").on(t.pedido_id),
    foreignKey({ columns: [t.pedido_id], foreignColumns: [pedidos.id], name: "envios_pedido_id_fkey" }),
    check(
      "envios_estado_check",
      sql`(estado)::text = ANY ((ARRAY['pendiente'::character varying, 'en_proceso'::character varying, 'terminado'::character varying])::text[])`,
    ),
  ],
)

export const servientregaCuenta = pgTable(
  "servientrega_cuenta",
  {
    id: serial("id").primaryKey(),
    periodo: varchar("periodo", { length: 7 }).notNull(),
    fecha_corte: date("fecha_corte"),
    total_cargos: money("total_cargos").default("0"),
    total_pagado: money("total_pagado").default("0"),
    saldo: money("saldo").default("0"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [unique("servientrega_cuenta_periodo_key").on(t.periodo)],
)

export const servientregaDetalle = pgTable(
  "servientrega_detalle",
  {
    id: serial("id").primaryKey(),
    cuenta_id: integer("cuenta_id").notNull(),
    envio_id: integer("envio_id"),
    monto: money("monto").notNull(),
    created_at: createdAt(),
  },
  (t) => [
    foreignKey({
      columns: [t.cuenta_id],
      foreignColumns: [servientregaCuenta.id],
      name: "servientrega_detalle_cuenta_id_fkey",
    }).onDelete("cascade"),
    foreignKey({ columns: [t.envio_id], foreignColumns: [envios.id], name: "servientrega_detalle_envio_id_fkey" }),
  ],
)

export const servientregaPagos = pgTable(
  "servientrega_pagos",
  {
    id: serial("id").primaryKey(),
    cuenta_id: integer("cuenta_id").notNull(),
    monto: money("monto").notNull(),
    metodo: varchar("metodo", { length: 50 }).notNull(),
    referencia: varchar("referencia", { length: 255 }).notNull(),
    fecha: ts("fecha")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    index("idx_servientrega_pagos_cuenta").on(t.cuenta_id),
    index("idx_servientrega_pagos_fecha").on(t.fecha),
    foreignKey({
      columns: [t.cuenta_id],
      foreignColumns: [servientregaCuenta.id],
      name: "servientrega_pagos_cuenta_id_fkey",
    }).onDelete("cascade"),
  ],
)

// ---------------------------------------------------------------------------
// Nómina
// ---------------------------------------------------------------------------

// No hay tabla de personas: persona_tipo es una categoría libre y el nombre de
// la persona va dentro de `concepto`. persona_id existe pero no se usa.
export const nominaMov = pgTable(
  "nomina_mov",
  {
    id: serial("id").primaryKey(),
    persona_tipo: varchar("persona_tipo", { length: 50 }).notNull(),
    persona_id: integer("persona_id"),
    pedido_id: integer("pedido_id"),
    concepto: text("concepto").notNull(),
    monto: money("monto").notNull(),
    fecha: date("fecha").notNull(),
    tipo: varchar("tipo", { length: 20, enum: NOMINA_TIPOS }),
    created_at: createdAt(),
  },
  (t) => [
    foreignKey({ columns: [t.pedido_id], foreignColumns: [pedidos.id], name: "nomina_mov_pedido_id_fkey" }),
    check(
      "nomina_mov_tipo_check",
      sql`(tipo)::text = ANY ((ARRAY['pago'::character varying, 'deduccion'::character varying, 'bono'::character varying])::text[])`,
    ),
  ],
)

// ---------------------------------------------------------------------------
// Proveedores y compras
// ---------------------------------------------------------------------------

export const proveedores = pgTable(
  "proveedores",
  {
    id: serial("id").primaryKey(),
    nombre: varchar("nombre", { length: 200 }).notNull(),
    ruc: varchar("ruc", { length: 20 }),
    telefono: varchar("telefono", { length: 20 }),
    email: varchar("email", { length: 100 }),
    direccion: text("direccion"),
    contacto_nombre: varchar("contacto_nombre", { length: 100 }),
    contacto_telefono: varchar("contacto_telefono", { length: 20 }),
    notas: text("notas"),
    activo: boolean("activo").default(true),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    index("idx_proveedores_nombre").on(t.nombre),
    index("idx_proveedores_ruc").on(t.ruc),
    unique("proveedores_ruc_key").on(t.ruc),
  ],
)

export const proveedorFacturas = pgTable(
  "proveedor_facturas",
  {
    id: serial("id").primaryKey(),
    proveedor_id: integer("proveedor_id").notNull(),
    numero_factura: varchar("numero_factura", { length: 50 }).notNull(),
    fecha_emision: date("fecha_emision").notNull(),
    fecha_vencimiento: date("fecha_vencimiento"),
    subtotal: money("subtotal").default("0").notNull(),
    iva: money("iva").default("0").notNull(),
    total: money("total").default("0").notNull(),
    pagado: money("pagado").default("0").notNull(),
    saldo: money("saldo").default("0").notNull(),
    estado: varchar("estado", { length: 20 }).default("pendiente"),
    notas: text("notas"),
    created_at: createdAt(),
    updated_at: updatedAt(),
  },
  (t) => [
    index("idx_proveedor_facturas_estado").on(t.estado),
    index("idx_proveedor_facturas_proveedor").on(t.proveedor_id),
    foreignKey({
      columns: [t.proveedor_id],
      foreignColumns: [proveedores.id],
      name: "proveedor_facturas_proveedor_id_fkey",
    }).onDelete("cascade"),
    check(
      "proveedor_facturas_estado_check",
      sql`(estado)::text = ANY ((ARRAY['pendiente'::character varying, 'pagada'::character varying, 'vencida'::character varying, 'anulada'::character varying])::text[])`,
    ),
  ],
)

export const proveedorFacturaItems = pgTable(
  "proveedor_factura_items",
  {
    id: serial("id").primaryKey(),
    factura_id: integer("factura_id").notNull(),
    producto_id: integer("producto_id"),
    descripcion: text("descripcion").notNull(),
    cantidad: money("cantidad").notNull(),
    precio_unitario: money("precio_unitario").notNull(),
    subtotal: money("subtotal").notNull(),
    created_at: createdAt(),
  },
  (t) => [
    index("idx_proveedor_factura_items_factura").on(t.factura_id),
    foreignKey({
      columns: [t.factura_id],
      foreignColumns: [proveedorFacturas.id],
      name: "proveedor_factura_items_factura_id_fkey",
    }).onDelete("cascade"),
    foreignKey({
      columns: [t.producto_id],
      foreignColumns: [productos.id],
      name: "proveedor_factura_items_producto_id_fkey",
    }),
  ],
)

export const proveedorPagos = pgTable(
  "proveedor_pagos",
  {
    id: serial("id").primaryKey(),
    factura_id: integer("factura_id").notNull(),
    fecha: ts("fecha").default(sql`CURRENT_TIMESTAMP`),
    monto: money("monto").notNull(),
    metodo: varchar("metodo", { length: 50 }),
    referencia: varchar("referencia", { length: 100 }),
    observacion: text("observacion"),
    created_at: createdAt(),
  },
  (t) => [
    index("idx_proveedor_pagos_factura").on(t.factura_id),
    foreignKey({
      columns: [t.factura_id],
      foreignColumns: [proveedorFacturas.id],
      name: "proveedor_pagos_factura_id_fkey",
    }).onDelete("cascade"),
  ],
)
