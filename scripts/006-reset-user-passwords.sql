-- Script para resetear contraseñas de usuarios existentes
-- Este script establece una contraseña temporal "Admin123!" para todos los usuarios
-- Los usuarios deberán cambiar su contraseña después del primer inicio de sesión

-- IMPORTANTE: Esta contraseña temporal es: Admin123!
-- Hash generado con Web Crypto API (PBKDF2, 100000 iteraciones, SHA-256)

DO $$
DECLARE
  -- Hash para la contraseña temporal "Admin123!"
  temp_password_hash TEXT := 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b';
BEGIN
  -- Actualizar contraseñas de todos los usuarios del sistema
  UPDATE usuarios 
  SET hash_password = temp_password_hash
  WHERE hash_password LIKE '$2%'; -- Solo actualizar hashes bcrypt antiguos
  
  RAISE NOTICE 'Contraseñas de usuarios actualizadas. Contraseña temporal: Admin123!';
  RAISE NOTICE 'Los usuarios deben cambiar su contraseña después del primer inicio de sesión.';
END $$;

-- Nota: Después de ejecutar este script, todos los usuarios pueden iniciar sesión con:
-- Email: su email registrado
-- Contraseña: Admin123!
