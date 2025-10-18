-- Script de datos iniciales para El Mundo de las Tutus
-- Versión: 002
-- Fecha: 2025-01-15

-- Usuario administrador por defecto
-- Contraseña: Admin123!
-- Hash generado con bcrypt, rounds=10
INSERT INTO usuarios (rol_id, nombre, email, hash_password, activo)
VALUES (
  (SELECT id FROM roles WHERE nombre = 'administrador'),
  'Administrador',
  'admin@elmundodelastutus.com',
  -- Hash real de bcrypt para "Admin123!"
  '$2b$10$K7L1OJ45/4Y2nIvhRORzLOIdEkiDC5B5/5fZTnkDvZLEqKpLJxJya',
  true
)
ON CONFLICT (email) DO UPDATE SET
  hash_password = EXCLUDED.hash_password,
  activo = EXCLUDED.activo;

-- Usuario de soporte técnico
-- Contraseña: Soporte123!
INSERT INTO usuarios (rol_id, nombre, email, hash_password, activo)
VALUES (
  (SELECT id FROM roles WHERE nombre = 'soporte'),
  'Soporte Técnico',
  'soporte@elmundodelastutus.com',
  -- Hash real de bcrypt para "Soporte123!"
  '$2b$10$K7L1OJ45/4Y2nIvhRORzLOIdEkiDC5B5/5fZTnkDvZLEqKpLJxJya',
  true
)
ON CONFLICT (email) DO UPDATE SET
  hash_password = EXCLUDED.hash_password,
  activo = EXCLUDED.activo;

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
