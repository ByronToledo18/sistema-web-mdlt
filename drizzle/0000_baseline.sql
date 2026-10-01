-- Baseline: estado de la base de producción al iniciar la Fase 2 (scripts 001–011).
-- NO se ejecuta: en una base existente se registra como aplicada con `pnpm db:baseline`.
-- Solo sirve para crear una base vacía desde cero (p. ej. una rama de Neon de test).

CREATE TABLE "auditoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"usuario_id" integer,
	"accion" varchar(100) NOT NULL,
	"modulo" varchar(50) NOT NULL,
	"descripcion" text,
	"ip_address" varchar(45),
	"user_agent" text,
	"metadata" jsonb,
	"fecha" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"telefono" varchar(20),
	"email" varchar(100),
	"direccion" text,
	"notas" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"cedula" varchar(20),
	"activo" boolean DEFAULT true,
	"hash_password" text,
	"ultimo_acceso" timestamp,
	"reset_token" text,
	"reset_token_expiry" timestamp,
	"requiere_cambio_password" boolean DEFAULT false,
	"debe_cambiar_password" boolean DEFAULT false,
	CONSTRAINT "clientes_cedula_key" UNIQUE("cedula")
);
--> statement-breakpoint
CREATE TABLE "disenos_personalizados" (
	"id" serial PRIMARY KEY NOT NULL,
	"cliente_id" integer NOT NULL,
	"descripcion" text NOT NULL,
	"imagen_url" text NOT NULL,
	"estado" varchar(20) DEFAULT 'generado' NOT NULL,
	"pedido_id" integer,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "disenos_personalizados_estado_check" CHECK ((estado)::text = ANY ((ARRAY['generado'::character varying, 'en_pedido'::character varying, 'descartado'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "envios" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"guia" varchar(100),
	"fecha_envio" timestamp,
	"estado" varchar(50),
	"costo" numeric(10, 2),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "envios_estado_check" CHECK ((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'en_proceso'::character varying, 'terminado'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "nomina_mov" (
	"id" serial PRIMARY KEY NOT NULL,
	"persona_tipo" varchar(50) NOT NULL,
	"persona_id" integer,
	"pedido_id" integer,
	"concepto" text NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"fecha" date NOT NULL,
	"tipo" varchar(20),
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "nomina_mov_tipo_check" CHECK ((tipo)::text = ANY ((ARRAY['pago'::character varying, 'deduccion'::character varying, 'bono'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "pagos" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"fecha" timestamp DEFAULT CURRENT_TIMESTAMP,
	"monto" numeric(10, 2) NOT NULL,
	"metodo" varchar(50),
	"referencia" varchar(100),
	"observacion" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "pedido_facturas" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"numero_factura" varchar(50) NOT NULL,
	"fecha_emision" date DEFAULT CURRENT_DATE NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"iva" numeric(10, 2) NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"estado" varchar(20) DEFAULT 'emitida' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "pedido_facturas_pedido_id_key" UNIQUE("pedido_id"),
	CONSTRAINT "pedido_facturas_numero_factura_key" UNIQUE("numero_factura"),
	CONSTRAINT "pedido_facturas_estado_check" CHECK ((estado)::text = ANY ((ARRAY['emitida'::character varying, 'anulada'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "pedido_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"item_tipo" varchar(20) NOT NULL,
	"item_id" integer NOT NULL,
	"descripcion" text,
	"cantidad" numeric(10, 2) NOT NULL,
	"precio_unitario" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "pedido_items_item_tipo_check" CHECK ((item_tipo)::text = ANY ((ARRAY['producto'::character varying, 'servicio'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(50) NOT NULL,
	"cliente_id" integer NOT NULL,
	"estado" varchar(20) DEFAULT 'recibido',
	"fecha_creacion" timestamp DEFAULT CURRENT_TIMESTAMP,
	"total" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"notas" text,
	"costo_envio" numeric(10, 2) DEFAULT '0',
	"ciudad_envio" varchar(100),
	"coordenadas_envio" jsonb,
	CONSTRAINT "pedidos_codigo_key" UNIQUE("codigo"),
	CONSTRAINT "pedidos_estado_check" CHECK ((estado)::text = ANY ((ARRAY['recibido'::character varying, 'en_proceso'::character varying, 'terminado'::character varying, 'anulado'::character varying, 'entregado'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" serial PRIMARY KEY NOT NULL,
	"sku" varchar(50),
	"nombre" varchar(100) NOT NULL,
	"precio" numeric(10, 2) NOT NULL,
	"stock" integer DEFAULT 0,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"imagen_url" text,
	CONSTRAINT "productos_sku_key" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "proveedor_factura_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"factura_id" integer NOT NULL,
	"producto_id" integer,
	"descripcion" text NOT NULL,
	"cantidad" numeric(10, 2) NOT NULL,
	"precio_unitario" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "proveedor_facturas" (
	"id" serial PRIMARY KEY NOT NULL,
	"proveedor_id" integer NOT NULL,
	"numero_factura" varchar(50) NOT NULL,
	"fecha_emision" date NOT NULL,
	"fecha_vencimiento" date,
	"subtotal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"iva" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"pagado" numeric(10, 2) DEFAULT '0' NOT NULL,
	"saldo" numeric(10, 2) DEFAULT '0' NOT NULL,
	"estado" varchar(20) DEFAULT 'pendiente',
	"notas" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "proveedor_facturas_estado_check" CHECK ((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'pagada'::character varying, 'vencida'::character varying, 'anulada'::character varying])::text[]))
);
--> statement-breakpoint
CREATE TABLE "proveedor_pagos" (
	"id" serial PRIMARY KEY NOT NULL,
	"factura_id" integer NOT NULL,
	"fecha" timestamp DEFAULT CURRENT_TIMESTAMP,
	"monto" numeric(10, 2) NOT NULL,
	"metodo" varchar(50),
	"referencia" varchar(100),
	"observacion" text,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "proveedores" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(200) NOT NULL,
	"ruc" varchar(20),
	"telefono" varchar(20),
	"email" varchar(100),
	"direccion" text,
	"contacto_nombre" varchar(100),
	"contacto_telefono" varchar(20),
	"notas" text,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "proveedores_ruc_key" UNIQUE("ruc")
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(50) NOT NULL,
	CONSTRAINT "roles_nombre_key" UNIQUE("nombre")
);
--> statement-breakpoint
CREATE TABLE "servicios" (
	"id" serial PRIMARY KEY NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"unidad" varchar(50),
	"precio_base" numeric(10, 2) NOT NULL,
	"variable" boolean DEFAULT false,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"imagen_url" text
);
--> statement-breakpoint
CREATE TABLE "servientrega_cuenta" (
	"id" serial PRIMARY KEY NOT NULL,
	"periodo" varchar(7) NOT NULL,
	"fecha_corte" date,
	"total_cargos" numeric(10, 2) DEFAULT '0',
	"total_pagado" numeric(10, 2) DEFAULT '0',
	"saldo" numeric(10, 2) DEFAULT '0',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "servientrega_cuenta_periodo_key" UNIQUE("periodo")
);
--> statement-breakpoint
CREATE TABLE "servientrega_detalle" (
	"id" serial PRIMARY KEY NOT NULL,
	"cuenta_id" integer NOT NULL,
	"envio_id" integer,
	"monto" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "servientrega_pagos" (
	"id" serial PRIMARY KEY NOT NULL,
	"cuenta_id" integer NOT NULL,
	"monto" numeric(10, 2) NOT NULL,
	"metodo" varchar(50) NOT NULL,
	"referencia" varchar(255) NOT NULL,
	"fecha" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "tarifas_envio" (
	"id" serial PRIMARY KEY NOT NULL,
	"ciudad" varchar(100) NOT NULL,
	"provincia" varchar(100),
	"costo" numeric(10, 2) NOT NULL,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "tarifas_envio_ciudad_key" UNIQUE("ciudad")
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" varchar(50) NOT NULL,
	"prioridad" varchar(20) NOT NULL,
	"descripcion" text NOT NULL,
	"email_contacto" varchar(255),
	"estado" varchar(20) DEFAULT 'pendiente',
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"rol_id" integer NOT NULL,
	"nombre" varchar(100) NOT NULL,
	"email" varchar(100) NOT NULL,
	"hash_password" varchar(255) NOT NULL,
	"activo" boolean DEFAULT true,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT "usuarios_email_key" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disenos_personalizados" ADD CONSTRAINT "disenos_personalizados_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disenos_personalizados" ADD CONSTRAINT "disenos_personalizados_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envios" ADD CONSTRAINT "envios_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nomina_mov" ADD CONSTRAINT "nomina_mov_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_facturas" ADD CONSTRAINT "pedido_facturas_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD CONSTRAINT "pedido_items_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proveedor_factura_items" ADD CONSTRAINT "proveedor_factura_items_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "public"."proveedor_facturas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proveedor_factura_items" ADD CONSTRAINT "proveedor_factura_items_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proveedor_facturas" ADD CONSTRAINT "proveedor_facturas_proveedor_id_fkey" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proveedor_pagos" ADD CONSTRAINT "proveedor_pagos_factura_id_fkey" FOREIGN KEY ("factura_id") REFERENCES "public"."proveedor_facturas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servientrega_detalle" ADD CONSTRAINT "servientrega_detalle_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "public"."servientrega_cuenta"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servientrega_detalle" ADD CONSTRAINT "servientrega_detalle_envio_id_fkey" FOREIGN KEY ("envio_id") REFERENCES "public"."envios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servientrega_pagos" ADD CONSTRAINT "servientrega_pagos_cuenta_id_fkey" FOREIGN KEY ("cuenta_id") REFERENCES "public"."servientrega_cuenta"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_auditoria_accion" ON "auditoria" USING btree ("accion");--> statement-breakpoint
CREATE INDEX "idx_auditoria_fecha" ON "auditoria" USING btree ("fecha" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_auditoria_modulo" ON "auditoria" USING btree ("modulo");--> statement-breakpoint
CREATE INDEX "idx_auditoria_usuario" ON "auditoria" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "idx_clientes_activo" ON "clientes" USING btree ("activo");--> statement-breakpoint
CREATE INDEX "idx_clientes_cedula" ON "clientes" USING btree ("cedula");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_clientes_cedula_unique" ON "clientes" USING btree ("cedula") WHERE (cedula IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_clientes_email" ON "clientes" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_clientes_email_unique" ON "clientes" USING btree ("email") WHERE (email IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_disenos_personalizados_cliente" ON "disenos_personalizados" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_envios_pedido" ON "envios" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "idx_pagos_pedido" ON "pagos" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "idx_pedido_facturas_pedido" ON "pedido_facturas" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "idx_pedido_items_pedido" ON "pedido_items" USING btree ("pedido_id");--> statement-breakpoint
CREATE INDEX "idx_pedidos_cliente" ON "pedidos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_pedidos_codigo" ON "pedidos" USING btree ("codigo");--> statement-breakpoint
CREATE INDEX "idx_pedidos_estado" ON "pedidos" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "idx_proveedor_factura_items_factura" ON "proveedor_factura_items" USING btree ("factura_id");--> statement-breakpoint
CREATE INDEX "idx_proveedor_facturas_estado" ON "proveedor_facturas" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "idx_proveedor_facturas_proveedor" ON "proveedor_facturas" USING btree ("proveedor_id");--> statement-breakpoint
CREATE INDEX "idx_proveedor_pagos_factura" ON "proveedor_pagos" USING btree ("factura_id");--> statement-breakpoint
CREATE INDEX "idx_proveedores_nombre" ON "proveedores" USING btree ("nombre");--> statement-breakpoint
CREATE INDEX "idx_proveedores_ruc" ON "proveedores" USING btree ("ruc");--> statement-breakpoint
CREATE INDEX "idx_servientrega_pagos_cuenta" ON "servientrega_pagos" USING btree ("cuenta_id");--> statement-breakpoint
CREATE INDEX "idx_servientrega_pagos_fecha" ON "servientrega_pagos" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "idx_tickets_created_at" ON "tickets" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_tickets_estado" ON "tickets" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "idx_usuarios_email" ON "usuarios" USING btree ("email");