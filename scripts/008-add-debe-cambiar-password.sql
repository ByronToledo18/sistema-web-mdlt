-- Add debe_cambiar_password column to clientes table if it doesn't exist
-- This column tracks whether a client needs to change their password on first login

DO $$ 
BEGIN
    -- Add debe_cambiar_password column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clientes' 
        AND column_name = 'debe_cambiar_password'
    ) THEN
        ALTER TABLE clientes ADD COLUMN debe_cambiar_password BOOLEAN DEFAULT false;
        RAISE NOTICE 'Column debe_cambiar_password added to clientes table';
    ELSE
        RAISE NOTICE 'Column debe_cambiar_password already exists in clientes table';
    END IF;
END $$;
