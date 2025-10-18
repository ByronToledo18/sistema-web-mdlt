-- Script para generar una nueva contraseña temporal
-- Este script crea un usuario administrador de prueba con contraseña conocida

-- Primero, eliminar el usuario de prueba si existe
DELETE FROM usuarios WHERE email = 'admin@test.com';

-- Crear usuario administrador de prueba
-- Email: admin@test.com
-- Contraseña: Admin123!
-- Hash generado con: echo -n "Admin123!" | openssl dgst -sha256 -hex

INSERT INTO usuarios (email, nombre, hash_password, rol_id, activo)
SELECT 
  'admin@test.com',
  'Administrador de Prueba',
  -- Este es un hash temporal - necesitas ejecutar el script de Node.js para generar el hash correcto
  'TEMP_HASH_REPLACE_ME',
  r.id,
  true
FROM roles r
WHERE r.nombre = 'Administrador'
LIMIT 1;

-- NOTA: Este script necesita ser completado con un hash válido
-- Para generar el hash correcto, ejecuta el siguiente código en Node.js:
-- 
-- const crypto = require('crypto');
-- const password = 'Admin123!';
-- const salt = crypto.randomBytes(16);
-- const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
-- const hash = `${salt.toString('hex')}:${key.toString('hex')}`;
-- console.log(hash);
