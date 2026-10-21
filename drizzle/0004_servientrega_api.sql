-- Integración con la API de Servientrega:
-- - envios: guía real de Servientrega (UNIQUE parcial), su estado
--   (generando/generada/anulada) y los datos con que se generó. La columna
--   "guia" (SER-YYYY-######) no cambia.
-- - servientrega_rotulos: la API entrega el rótulo PDF una sola vez, así que
--   se guarda la primera descarga.
CREATE TABLE "servientrega_rotulos" (
	"guia_servientrega" varchar(30) PRIMARY KEY NOT NULL,
	"envio_id" integer NOT NULL,
	"pdf_base64" text NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
ALTER TABLE "envios" ADD COLUMN "guia_servientrega" varchar(30);--> statement-breakpoint
ALTER TABLE "envios" ADD COLUMN "servientrega_estado" varchar(20);--> statement-breakpoint
ALTER TABLE "envios" ADD COLUMN "servientrega_ciudad_destino_id" integer;--> statement-breakpoint
ALTER TABLE "envios" ADD COLUMN "servientrega_producto_id" integer;--> statement-breakpoint
ALTER TABLE "envios" ADD COLUMN "peso_kg" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "envios" ADD COLUMN "piezas" integer;--> statement-breakpoint
ALTER TABLE "envios" ADD COLUMN "contenido" varchar(200);--> statement-breakpoint
ALTER TABLE "envios" ADD COLUMN "guia_generada_at" timestamp;--> statement-breakpoint
ALTER TABLE "envios" ADD COLUMN "guia_anulada_at" timestamp;--> statement-breakpoint
ALTER TABLE "servientrega_rotulos" ADD CONSTRAINT "servientrega_rotulos_envio_id_fkey" FOREIGN KEY ("envio_id") REFERENCES "public"."envios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_servientrega_rotulos_envio" ON "servientrega_rotulos" USING btree ("envio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "envios_guia_servientrega_key" ON "envios" USING btree ("guia_servientrega") WHERE (guia_servientrega IS NOT NULL);--> statement-breakpoint
ALTER TABLE "envios" ADD CONSTRAINT "envios_servientrega_estado_check" CHECK ((servientrega_estado IS NULL OR servientrega_estado IN ('generando', 'generada', 'anulada')));