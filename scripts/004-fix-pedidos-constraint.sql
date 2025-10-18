-- Fix pedidos estado check constraint
-- This script updates the constraint to use the new status names
-- Reordered operations: drop constraint, update data, then create new constraint

-- Step 1: Drop the old constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'pedidos_estado_check'
    ) THEN
        ALTER TABLE pedidos DROP CONSTRAINT pedidos_estado_check;
    END IF;
END $$;

-- Step 2: Update any existing old status values to new ones
UPDATE pedidos SET estado = 'en_proceso' WHERE estado = 'procesado';
UPDATE pedidos SET estado = 'terminado' WHERE estado = 'completado';
UPDATE pedidos SET estado = 'anulado' WHERE estado = 'cancelado';

-- Step 3: Create the new constraint with updated status values
ALTER TABLE pedidos 
ADD CONSTRAINT pedidos_estado_check 
CHECK (estado IN ('recibido', 'en_proceso', 'terminado', 'anulado', 'entregado'));
