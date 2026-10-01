-- Script para eliminar todos los registros excepto roles, usuarios, productos y servicios
-- Este script es destructivo y debe ejecutarse con precaución

-- Eliminar registros en el orden correcto respetando foreign keys
-- Primero las tablas más dependientes (hijas), luego las padres

-- Tablas de Servientrega (eliminar detalle antes que cuenta y envíos)
DELETE FROM servientrega_detalle;
DELETE FROM servientrega_cuenta;

-- Tablas de proveedores (eliminar pagos e items antes que facturas)
DELETE FROM pagos_proveedor;
DELETE FROM factura_items;
DELETE FROM facturas_proveedor;
DELETE FROM proveedores;

-- Tabla de tickets (independiente)
DELETE FROM tickets;

-- Tabla de nómina (independiente)
DELETE FROM nomina_mov;

-- Tablas de pedidos (eliminar items, pagos y envíos antes que pedidos)
DELETE FROM envios;
DELETE FROM pagos;
DELETE FROM pedido_items;
DELETE FROM pedidos;

-- Tabla de clientes (después de eliminar pedidos que la referencian)
DELETE FROM clientes;

-- Tabla de auditoría (independiente)
DELETE FROM auditoria;

-- Reiniciar secuencias para comenzar con IDs limpios
ALTER SEQUENCE clientes_id_seq RESTART WITH 1;
ALTER SEQUENCE pedidos_id_seq RESTART WITH 1;
ALTER SEQUENCE pedido_items_id_seq RESTART WITH 1;
ALTER SEQUENCE pagos_id_seq RESTART WITH 1;
ALTER SEQUENCE envios_id_seq RESTART WITH 1;
ALTER SEQUENCE tickets_id_seq RESTART WITH 1;
ALTER SEQUENCE proveedores_id_seq RESTART WITH 1;
ALTER SEQUENCE facturas_proveedor_id_seq RESTART WITH 1;
ALTER SEQUENCE factura_items_id_seq RESTART WITH 1;
ALTER SEQUENCE pagos_proveedor_id_seq RESTART WITH 1;
ALTER SEQUENCE auditoria_id_seq RESTART WITH 1;
ALTER SEQUENCE servientrega_cuenta_id_seq RESTART WITH 1;
ALTER SEQUENCE servientrega_detalle_id_seq RESTART WITH 1;
ALTER SEQUENCE nomina_mov_id_seq RESTART WITH 1;

-- Nota: NO se eliminan ni modifican:
-- - roles (tabla de roles del sistema)
-- - usuarios (cuentas de administradores y asistentes)
-- - productos (inventario de productos)
-- - servicios (catálogo de servicios)
-- - tarifas_envio (tarifas de envío por ciudad)
