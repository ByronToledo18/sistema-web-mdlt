-- Catálogo con Diseño IA: el cliente describe cómo quiere su tutú y una IA
-- (Gemini, gemini-3.1-flash-image) genera una vista previa. Se guarda la
-- referencia para poder ligarla a un pedido si el cliente decide comprarlo.

CREATE TABLE IF NOT EXISTS disenos_personalizados (
  id SERIAL PRIMARY KEY,
  cliente_id INTEGER NOT NULL REFERENCES clientes(id),
  descripcion TEXT NOT NULL,
  imagen_url TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'generado' CHECK (estado IN ('generado', 'en_pedido', 'descartado')),
  pedido_id INTEGER REFERENCES pedidos(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_disenos_personalizados_cliente ON disenos_personalizados(cliente_id);

-- Servicio de catálogo al que se asocia un diseño IA cuando el cliente lo
-- agrega al carrito (el checkout solo acepta productos/servicios reales de
-- la base, nunca precios sueltos del cliente - ver app/api/catalogo/pedido).
-- servicios no tiene UNIQUE(nombre), por eso se usa NOT EXISTS en vez de
-- ON CONFLICT (que fallaría sin una constraint que apuntar).
INSERT INTO servicios (nombre, unidad, precio_base, variable, activo)
SELECT 'Diseño Personalizado con IA', 'diseño', 25.00, false, true
WHERE NOT EXISTS (
  SELECT 1 FROM servicios WHERE nombre = 'Diseño Personalizado con IA'
);
