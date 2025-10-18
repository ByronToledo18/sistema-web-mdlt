-- Script para actualizar bases de datos existentes
-- Este script es OPCIONAL y solo debe ejecutarse si ya tienes una base de datos creada
-- Si estás empezando desde cero, solo ejecuta 001 y 002

-- ============================================
-- PASO 1: Eliminar restricciones problemáticas
-- ============================================

-- Eliminar restricción CHECK antigua de pedidos
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'pedidos_estado_check'
    ) THEN
        ALTER TABLE pedidos DROP CONSTRAINT pedidos_estado_check;
    END IF;
END $$;

-- Eliminar restricción CHECK antigua de envios
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'envios_estado_check'
    ) THEN
        ALTER TABLE envios DROP CONSTRAINT envios_estado_check;
    END IF;
END $$;

-- ============================================
-- PASO 2: Agregar columnas faltantes
-- ============================================

-- Agregar columnas a clientes
DO $$ 
BEGIN
    -- cedula
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clientes' AND column_name = 'cedula'
    ) THEN
        ALTER TABLE clientes ADD COLUMN cedula VARCHAR(20);
    END IF;
    
    -- hash_password
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clientes' AND column_name = 'hash_password'
    ) THEN
        ALTER TABLE clientes ADD COLUMN hash_password TEXT;
    END IF;
    
    -- activo
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clientes' AND column_name = 'activo'
    ) THEN
        ALTER TABLE clientes ADD COLUMN activo BOOLEAN DEFAULT true;
    END IF;
    
    -- ultimo_acceso
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clientes' AND column_name = 'ultimo_acceso'
    ) THEN
        ALTER TABLE clientes ADD COLUMN ultimo_acceso TIMESTAMP;
    END IF;
    
    -- reset_token
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clientes' AND column_name = 'reset_token'
    ) THEN
        ALTER TABLE clientes ADD COLUMN reset_token TEXT;
    END IF;
    
    -- reset_token_expiry
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clientes' AND column_name = 'reset_token_expiry'
    ) THEN
        ALTER TABLE clientes ADD COLUMN reset_token_expiry TIMESTAMP;
    END IF;
    
    -- requiere_cambio_password
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clientes' AND column_name = 'requiere_cambio_password'
    ) THEN
        ALTER TABLE clientes ADD COLUMN requiere_cambio_password BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Agregar columnas a pedidos
DO $$ 
BEGIN
    -- notas
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pedidos' AND column_name = 'notas'
    ) THEN
        ALTER TABLE pedidos ADD COLUMN notas TEXT;
    END IF;
    
    -- costo_envio
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pedidos' AND column_name = 'costo_envio'
    ) THEN
        ALTER TABLE pedidos ADD COLUMN costo_envio DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- ciudad_envio
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pedidos' AND column_name = 'ciudad_envio'
    ) THEN
        ALTER TABLE pedidos ADD COLUMN ciudad_envio VARCHAR(100);
    END IF;
    
    -- coordenadas_envio
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'pedidos' AND column_name = 'coordenadas_envio'
    ) THEN
        ALTER TABLE pedidos ADD COLUMN coordenadas_envio TEXT;
    END IF;
END $$;

-- Agregar imagen_url a productos y servicios si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'productos' AND column_name = 'imagen_url'
    ) THEN
        ALTER TABLE productos ADD COLUMN imagen_url TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'servicios' AND column_name = 'imagen_url'
    ) THEN
        ALTER TABLE servicios ADD COLUMN imagen_url TEXT;
    END IF;
END $$;

-- ============================================
-- PASO 3: Actualizar valores de estado
-- ============================================

-- Actualizar estados de pedidos
UPDATE pedidos SET estado = 'en_proceso' WHERE estado = 'procesado';
UPDATE pedidos SET estado = 'terminado' WHERE estado = 'completado';
UPDATE pedidos SET estado = 'anulado' WHERE estado = 'cancelado';

-- Actualizar estados de envios
UPDATE envios SET estado = 'en_proceso' WHERE estado = 'procesado';
UPDATE envios SET estado = 'terminado' WHERE estado = 'completado';

-- ============================================
-- PASO 4: Crear nuevas restricciones CHECK
-- ============================================

-- Agregar nueva restricción CHECK para pedidos
ALTER TABLE pedidos ADD CONSTRAINT pedidos_estado_check 
    CHECK (estado IN ('recibido', 'en_proceso', 'terminado', 'anulado', 'entregado'));

-- Agregar nueva restricción CHECK para envios
ALTER TABLE envios ADD CONSTRAINT envios_estado_check 
    CHECK (estado IN ('pendiente', 'en_proceso', 'terminado'));

-- ============================================
-- PASO 5: Manejar duplicados de email
-- ============================================

-- Fixed PL/pgSQL syntax for handling duplicate emails
DO $$ 
DECLARE
    dup_email VARCHAR(255);
    dup_ids INTEGER[];
    dup_id INTEGER;
    counter INTEGER;
BEGIN
    FOR dup_email, dup_ids IN 
        SELECT email, array_agg(id ORDER BY created_at) as ids
        FROM clientes 
        WHERE email IS NOT NULL
        GROUP BY email 
        HAVING COUNT(*) > 1
    LOOP
        counter := 1;
        -- Mantener el primer registro, modificar los demás
        FOREACH dup_id IN ARRAY dup_ids[2:array_length(dup_ids, 1)]
        LOOP
            UPDATE clientes 
            SET email = dup_email || '_dup' || counter
            WHERE id = dup_id;
            counter := counter + 1;
        END LOOP;
    END LOOP;
END $$;

-- Crear índice único en email
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_clientes_email_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_clientes_email_unique ON clientes(email) 
        WHERE email IS NOT NULL;
    END IF;
END $$;

-- Crear índice único en cedula
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_clientes_cedula_unique'
    ) THEN
        CREATE UNIQUE INDEX idx_clientes_cedula_unique ON clientes(cedula) 
        WHERE cedula IS NOT NULL;
    END IF;
END $$;

-- ============================================
-- PASO 6: Crear tablas faltantes
-- ============================================

-- Tabla de auditoría
CREATE TABLE IF NOT EXISTS auditoria (
    id SERIAL PRIMARY KEY,
    tabla VARCHAR(50) NOT NULL,
    operacion VARCHAR(10) NOT NULL,
    usuario_id INTEGER REFERENCES usuarios(id),
    registro_id INTEGER,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vista de compatibilidad para audit_logs
CREATE OR REPLACE VIEW audit_logs AS SELECT * FROM auditoria;

-- Tabla de tarifas de envío
CREATE TABLE IF NOT EXISTS tarifas_envio (
    id SERIAL PRIMARY KEY,
    ciudad VARCHAR(100) NOT NULL UNIQUE,
    costo DECIMAL(10,2) NOT NULL,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Removed tiempo_estimado_dias column to match base schema
-- Insertar tarifas de envío si no existen
INSERT INTO tarifas_envio (ciudad, costo) VALUES
    ('Guayaquil', 3.50),
    ('Durán', 5.00),
    ('Samborondón', 5.00),
    ('Quito', 6.00),
    ('Cuenca', 6.00),
    ('Machala', 6.00),
    ('Manta', 6.00),
    ('Portoviejo', 6.00),
    ('Ambato', 6.00),
    ('Riobamba', 6.00),
    ('Loja', 6.00),
    ('Esmeraldas', 6.00),
    ('Santo Domingo', 6.00),
    ('Ibarra', 6.00),
    ('Galápagos', 10.00)
ON CONFLICT (ciudad) DO NOTHING;

-- Tabla de tickets de soporte
CREATE TABLE IF NOT EXISTS tickets (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    asunto VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    email VARCHAR(255) NOT NULL,
    estado VARCHAR(20) DEFAULT 'abierto' CHECK (estado IN ('abierto', 'en_proceso', 'resuelto', 'cerrado')),
    prioridad VARCHAR(20) DEFAULT 'media' CHECK (prioridad IN ('baja', 'media', 'alta', 'urgente')),
    asignado_a INTEGER REFERENCES usuarios(id),
    respuesta TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resuelto_at TIMESTAMP
);

-- Tabla de proveedores
CREATE TABLE IF NOT EXISTS proveedores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    ruc VARCHAR(20) UNIQUE,
    contacto VARCHAR(200),
    telefono VARCHAR(20),
    email VARCHAR(255),
    direccion TEXT,
    ciudad VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    notas TEXT,
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
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    iva DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    pagado DECIMAL(10,2) NOT NULL DEFAULT 0,
    saldo DECIMAL(10,2) NOT NULL DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada', 'vencida', 'cancelada')),
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(proveedor_id, numero_factura)
);

-- Tabla de items de facturas
CREATE TABLE IF NOT EXISTS factura_items (
    id SERIAL PRIMARY KEY,
    factura_id INTEGER NOT NULL REFERENCES facturas_proveedor(id) ON DELETE CASCADE,
    producto_id INTEGER REFERENCES productos(id),
    descripcion TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PASO 7: Crear triggers para updated_at
-- ============================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para tarifas_envio
DROP TRIGGER IF EXISTS update_tarifas_envio_updated_at ON tarifas_envio;
CREATE TRIGGER update_tarifas_envio_updated_at
    BEFORE UPDATE ON tarifas_envio
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers para tickets
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers para proveedores
DROP TRIGGER IF EXISTS update_proveedores_updated_at ON proveedores;
CREATE TRIGGER update_proveedores_updated_at
    BEFORE UPDATE ON proveedores
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers para facturas_proveedor
DROP TRIGGER IF EXISTS update_facturas_proveedor_updated_at ON facturas_proveedor;
CREATE TRIGGER update_facturas_proveedor_updated_at
    BEFORE UPDATE ON facturas_proveedor
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FINALIZADO
-- ============================================

-- Mensaje de confirmación
DO $$ 
BEGIN
    RAISE NOTICE 'Base de datos actualizada exitosamente';
END $$;
