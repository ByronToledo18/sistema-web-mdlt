-- Fix envios table CHECK constraint to use new status values

-- Drop old constraint
ALTER TABLE envios DROP CONSTRAINT IF EXISTS envios_estado_check;

-- Update existing data to new status values
UPDATE envios SET estado = 'en_proceso' WHERE estado = 'procesado';
UPDATE envios SET estado = 'terminado' WHERE estado = 'completado';

-- Create new constraint with correct values
ALTER TABLE envios ADD CONSTRAINT envios_estado_check 
  CHECK (estado IN ('pendiente', 'en_proceso', 'terminado'));
