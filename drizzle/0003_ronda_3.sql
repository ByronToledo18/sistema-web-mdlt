-- Ronda 3:
-- - IVA por ítem: productos/servicios.graba_iva (por defecto true: los precios
--   del catálogo no incluyen IVA); pedido_items.graba_iva/iva copian el flag y
--   el IVA de la línea. Las líneas existentes quedan en false/0, así los
--   totales históricos de los pedidos no cambian.
-- - pedido_facturas.subtotal_0: base de los ítems que no gravan IVA.
-- - usuarios.debe_cambiar_password.
-- - Unicidad de email sin distinguir mayúsculas: índices únicos sobre
--   lower(email). Antes se normalizan los emails guardados (trim + minúsculas)
--   para que la búsqueda por lower(email) encuentre las filas antiguas. Si dos
--   filas chocan al normalizarse, la migración falla y hay que resolverlas a mano.
DROP INDEX "idx_clientes_email";--> statement-breakpoint
DROP INDEX "idx_clientes_email_unique";--> statement-breakpoint
DROP INDEX "idx_usuarios_email";--> statement-breakpoint
ALTER TABLE "pedido_facturas" ADD COLUMN "subtotal_0" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD COLUMN "graba_iva" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pedido_items" ADD COLUMN "iva" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "productos" ADD COLUMN "graba_iva" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "servicios" ADD COLUMN "graba_iva" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "debe_cambiar_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "usuarios" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));--> statement-breakpoint
UPDATE "clientes" SET "email" = lower(trim("email")) WHERE "email" <> lower(trim("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "clientes_email_lower_key" ON "clientes" USING btree (lower("email")) WHERE (email IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_lower_key" ON "usuarios" USING btree (lower("email"));