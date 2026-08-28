-- Facturación al cliente final (hasta ahora solo existía facturación de
-- compras a proveedores, en proveedor_facturas - ver app/api/proveedores/[id]/facturas).
-- Una factura por pedido, generada a partir de sus pedido_items existentes.

CREATE TABLE IF NOT EXISTS pedido_facturas (
  id SERIAL PRIMARY KEY,
  pedido_id INTEGER NOT NULL UNIQUE REFERENCES pedidos(id),
  numero_factura VARCHAR(50) NOT NULL UNIQUE,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal DECIMAL(10, 2) NOT NULL,
  iva DECIMAL(10, 2) NOT NULL,
  total DECIMAL(10, 2) NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'emitida' CHECK (estado IN ('emitida', 'anulada')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pedido_facturas_pedido ON pedido_facturas(pedido_id);
