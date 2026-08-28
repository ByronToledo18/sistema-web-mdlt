-- Script de datos iniciales para El Mundo de las Tutus
-- Versión: 002
-- Fecha: 2025-01-15

-- Los usuarios internos (administrador, soporte) ya NO se siembran aquí con una
-- contraseña/hash fija: el formato bcrypt de este archivo es incompatible con
-- verifyPassword() en lib/auth.ts (PBKDF2/Web Crypto), y una contraseña
-- hardcodeada conocida es un riesgo de seguridad por sí sola.
-- Para crear o resetear estos usuarios con una contraseña aleatoria generada
-- en el momento, ejecuta: node --loader ts-node/esm scripts/create-admin.ts

-- Productos de ejemplo
INSERT INTO productos (sku, nombre, precio, stock, activo) VALUES
  ('TUTU-001', 'Tutú Clásico Rosa', 45.00, 10, true),
  ('TUTU-002', 'Tutú Unicornio', 55.00, 8, true),
  ('TUTU-003', 'Tutú Princesa', 50.00, 12, true),
  ('ACC-001', 'Corona Dorada', 15.00, 20, true),
  ('ACC-002', 'Varita Mágica', 12.00, 15, true)
ON CONFLICT (sku) DO NOTHING;

-- Servicios de ejemplo
-- Agregado servicio de Envío para incluir costo de envío en pedidos
INSERT INTO servicios (nombre, unidad, precio_base, variable, activo) VALUES
  ('Confección Tutú Personalizado', 'unidad', 60.00, true, true),
  ('Bordado Nombre', 'nombre', 8.00, false, true),
  ('Aplicación Lentejuelas', 'área', 15.00, true, true),
  ('Diseño Personalizado', 'diseño', 25.00, true, true),
  ('Envío', 'envío', 5.00, true, true)
ON CONFLICT DO NOTHING;

-- Cliente de ejemplo
INSERT INTO clientes (nombre, telefono, email, direccion, notas) VALUES
  ('María González', '0987654321', 'maria.gonzalez@example.com', 'Av. Principal 123, Quito', 'Cliente frecuente')
ON CONFLICT DO NOTHING;
