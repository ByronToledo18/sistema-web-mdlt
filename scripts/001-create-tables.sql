-- Script de creación de tablas para El Mundo de las Tutus
-- Versión: 001 (Actualizado)
-- Fecha: 2025-01-17

-- Tabla de roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(50) NOT NULL UNIQUE
);

-- Insertar roles predefinidos
INSERT INTO roles (nombre) VALUES 
  ('administrador'),
  ('asistente'),
  ('soporte')
ON CONFLICT (nombre) DO NOTHING;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  rol_id INTEGER NOT NULL REFERENCES roles(id),
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  hash_password VARCHAR(255) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de clientes (con campos de autenticación)
CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  cedula VARCHAR(20) UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  telefono VARCHAR(20),
  email VARCHAR(100) UNIQUE,
  direccion TEXT,
  notas TEXT,
  hash_password VARCHAR(255),
  activo BOOLEAN DEFAULT true,
  ultimo_acceso TIMESTAMP,
  reset_token VARCHAR(255),
  reset_token_expiry TIMESTAMP,
  debe_cambiar_password BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de productos
CREATE TABLE IF NOT EXISTS productos (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE,
  nombre VARCHAR(100) NOT NULL,
  precio DECIMAL(10, 2) NOT NULL,
  stock INTEGER DEFAULT 0,
  imagen_url TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de servicios
CREATE TABLE IF NOT EXISTS servicios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  unidad VARCHAR(50),
  precio_base DECIMAL(10, 2) NOT NULL,
  variable BOOLEAN DEFAULT false,
  imagen_url TEXT,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de tarifas de envío por ciudad
CREATE TABLE IF NOT EXISTS tarifas_envio (
  id SERIAL PRIMARY KEY,
  ciudad VARCHAR(100) NOT NULL UNIQUE,
  costo DECIMAL(10, 2) NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insertar tarifas de envío predefinidas
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

-- Tabla de pedidos (con nuevos estados y campos de envío)
CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  codigo VARCHAR(50) NOT NULL UNIQUE,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  estado VARCHAR(20) DEFAULT 'recibido' CHECK (estado IN ('recibido', 'en_proceso', 'terminado', 'anulado', 'entregado')),
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total DECIMAL(10, 2) DEFAULT 0,
  notas TEXT,
  costo_envio DECIMAL(10, 2),
  ciudad_envio VARCHAR(100),
  coordenadas_envio TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de items de pedido (productos y servicios)
CREATE TABLE IF NOT EXISTS pedido_items (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  item_tipo VARCHAR(20) NOT NULL CHECK (item_tipo IN ('producto', 'servicio')),
  item_id INTEGER NOT NULL,
  descripcion TEXT,
  cantidad DECIMAL(10, 2) NOT NULL,
  precio_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de pagos (renombrada a cobros en UI)
CREATE TABLE IF NOT EXISTS pagos (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  monto DECIMAL(10, 2) NOT NULL,
  metodo VARCHAR(50),
  referencia VARCHAR(100),
  observacion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de envíos
CREATE TABLE IF NOT EXISTS envios (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL REFERENCES pedidos(id),
  guia VARCHAR(100),
  fecha_envio TIMESTAMP,
  estado VARCHAR(50) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_proceso', 'terminado')),
  costo DECIMAL(10, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de cuenta Servientrega (consolidación mensual)
CREATE TABLE IF NOT EXISTS servientrega_cuenta (
  id SERIAL PRIMARY KEY,
  periodo VARCHAR(7) NOT NULL UNIQUE,
  fecha_corte DATE,
  total_cargos DECIMAL(10, 2) DEFAULT 0,
  total_pagado DECIMAL(10, 2) DEFAULT 0,
  saldo DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de detalle de cuenta Servientrega
CREATE TABLE IF NOT EXISTS servientrega_detalle (
  id SERIAL PRIMARY KEY,
  cuenta_id INTEGER NOT NULL REFERENCES servientrega_cuenta(id) ON DELETE CASCADE,
  envio_id INTEGER REFERENCES envios(id),
  monto DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS auditoria (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER REFERENCES usuarios(id),
  accion VARCHAR(100) NOT NULL,
  tabla VARCHAR(50),
  registro_id INTEGER,
  detalles TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vista para compatibilidad con código que usa "audit_logs"
CREATE OR REPLACE VIEW audit_logs AS SELECT * FROM auditoria;

-- Tabla de tickets de soporte
CREATE TABLE IF NOT EXISTS tickets (
  id SERIAL PRIMARY KEY,
  tipo VARCHAR(50) NOT NULL,
  asunto VARCHAR(255) NOT NULL,
  descripcion TEXT,
  estado VARCHAR(20) DEFAULT 'abierto' CHECK (estado IN ('abierto', 'en_proceso', 'resuelto', 'cerrado')),
  prioridad VARCHAR(20) DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
  solicitante_email VARCHAR(100),
  solicitante_nombre VARCHAR(100),
  asignado_a INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS proveedores (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  ruc VARCHAR(20) UNIQUE,
  telefono VARCHAR(20),
  email VARCHAR(100),
  direccion TEXT,
  contacto VARCHAR(100),
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de facturas de proveedores
CREATE TABLE IF NOT EXISTS facturas_proveedor (
  id SERIAL PRIMARY KEY,
  proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
  numero_factura VARCHAR(50) NOT NULL,
  fecha_emision DATE NOT NULL,
  fecha_vencimiento DATE,
  subtotal DECIMAL(10, 2) NOT NULL,
  iva DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada', 'vencida', 'cancelada')),
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de items de facturas de proveedores
CREATE TABLE IF NOT EXISTS factura_items (
  id SERIAL PRIMARY KEY,
  factura_id INTEGER NOT NULL REFERENCES facturas_proveedor(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id),
  descripcion TEXT NOT NULL,
  cantidad DECIMAL(10, 2) NOT NULL,
  precio_unitario DECIMAL(10, 2) NOT NULL,
  subtotal DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de pagos a proveedores
CREATE TABLE IF NOT EXISTS pagos_proveedor (
  id SERIAL PRIMARY KEY,
  factura_id INTEGER NOT NULL REFERENCES facturas_proveedor(id),
  fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  monto DECIMAL(10, 2) NOT NULL,
  metodo VARCHAR(50),
  referencia VARCHAR(100),
  observacion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de movimientos de nómina
CREATE TABLE IF NOT EXISTS nomina_mov (
  id SERIAL PRIMARY KEY,
  persona_tipo VARCHAR(50) NOT NULL,
  persona_id INTEGER,
  pedido_id INTEGER REFERENCES pedidos(id),
  concepto TEXT NOT NULL,
  monto DECIMAL(10, 2) NOT NULL,
  fecha DATE NOT NULL,
  tipo VARCHAR(20) CHECK (tipo IN ('pago', 'deduccion', 'bono')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_pedidos_codigo ON pedidos(codigo);
CREATE INDEX IF NOT EXISTS idx_pedidos_cliente ON pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos(estado);
CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON pedido_items(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pagos_pedido ON pagos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_envios_pedido ON envios(pedido_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_clientes_cedula ON clientes(cedula);
CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets(estado);
CREATE INDEX IF NOT EXISTS idx_facturas_proveedor ON facturas_proveedor(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado ON facturas_proveedor(estado);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_productos_updated_at ON productos;
CREATE TRIGGER update_productos_updated_at BEFORE UPDATE ON productos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_servicios_updated_at ON servicios;
CREATE TRIGGER update_servicios_updated_at BEFORE UPDATE ON servicios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pedidos_updated_at ON pedidos;
CREATE TRIGGER update_pedidos_updated_at BEFORE UPDATE ON pedidos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_envios_updated_at ON envios;
CREATE TRIGGER update_envios_updated_at BEFORE UPDATE ON envios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_servientrega_cuenta_updated_at ON servientrega_cuenta;
CREATE TRIGGER update_servientrega_cuenta_updated_at BEFORE UPDATE ON servientrega_cuenta
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tarifas_envio_updated_at ON tarifas_envio;
CREATE TRIGGER update_tarifas_envio_updated_at BEFORE UPDATE ON tarifas_envio
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_proveedores_updated_at ON proveedores;
CREATE TRIGGER update_proveedores_updated_at BEFORE UPDATE ON proveedores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_facturas_proveedor_updated_at ON facturas_proveedor;
CREATE TRIGGER update_facturas_proveedor_updated_at BEFORE UPDATE ON facturas_proveedor
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
