-- Datos de referencia que la app necesita para funcionar en una base nueva.
-- Idempotente: en una base que ya los tiene no cambia nada.
--
-- - roles: los tres perfiles de lib/permissions.ts.
-- - tarifas_envio: tarifas por ciudad del checkout del catálogo.
-- - servicios "Envío": server/services/envios.ts lo busca por nombre
--   (SERVICIO_ENVIO) para cobrar el envío en los pedidos.
--
-- Los usuarios internos NO se siembran aquí: se crean con scripts/create-admin.ts.

INSERT INTO roles (nombre) VALUES
  ('administrador'),
  ('asistente'),
  ('soporte')
ON CONFLICT (nombre) DO NOTHING;
--> statement-breakpoint
INSERT INTO tarifas_envio (ciudad, costo) VALUES
  ('Guayaquil', 3.50),
  ('Durán', 5.00),
  ('Galápagos', 10.00),
  ('Quito', 6.00),
  ('Cuenca', 6.00),
  ('Ambato', 6.00),
  ('Manta', 6.00),
  ('Portoviejo', 6.00),
  ('Machala', 6.00),
  ('Santo Domingo', 6.00),
  ('Loja', 6.00),
  ('Riobamba', 6.00),
  ('Esmeraldas', 6.00),
  ('Ibarra', 6.00),
  ('Otra ciudad', 6.00)
ON CONFLICT (ciudad) DO NOTHING;
--> statement-breakpoint
INSERT INTO servicios (nombre, unidad, precio_base, variable, activo)
SELECT 'Envío', 'envío', 5.00, true, true
WHERE NOT EXISTS (SELECT 1 FROM servicios WHERE nombre = 'Envío');
