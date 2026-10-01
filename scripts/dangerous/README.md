# ⚠️ Scripts destructivos

Los scripts de esta carpeta **borran datos de forma irreversible**. No son migraciones
y nunca deben ejecutarse como parte del setup normal.

- `005-cleanup-all-data.sql` — elimina todos los registros de negocio (pedidos, pagos,
  envíos, proveedores, nómina, clientes...) dejando solo roles, usuarios, productos y servicios.

Antes de ejecutar cualquiera:
1. Confirma que estás conectado a la base correcta (nunca producción sin un respaldo).
2. Crea una rama/backup en Neon.
