-- SQL to create emails table in Supabase
-- Copy and paste ONLY the SQL below into Supabase SQL Editor

-- Step 1: Create emails table
CREATE TABLE IF NOT EXISTS emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  image_id UUID,
  source TEXT DEFAULT 'checkout',
  has_purchased BOOLEAN DEFAULT FALSE,
  purchased_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 1b: Add columns if they don't exist (for existing tables)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'has_purchased') THEN
    ALTER TABLE emails ADD COLUMN has_purchased BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'emails' AND column_name = 'purchased_at') THEN
    ALTER TABLE emails ADD COLUMN purchased_at TIMESTAMPTZ;
  END IF;
END $$;

-- Step 2: Add foreign key constraint (only if portraits table exists)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'portraits') THEN
    ALTER TABLE emails ADD CONSTRAINT fk_emails_image_id 
      FOREIGN KEY (image_id) REFERENCES portraits(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_emails_email ON emails(email);
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_emails_has_purchased ON emails(has_purchased);
CREATE INDEX IF NOT EXISTS idx_emails_purchased_at ON emails(purchased_at DESC);

-- Step 4: Enable Row Level Security (RLS)
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Step 5: Drop existing policy if it exists, then create new one
DROP POLICY IF EXISTS "Service role can manage emails" ON emails;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON emails;
DROP POLICY IF EXISTS "Enable all operations for service role" ON emails;

-- Policy: Allow service_role (used by API) to do everything
CREATE POLICY "Enable all operations for service role" ON emails
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Policy: Block all public/anonymous access (security)
CREATE POLICY "Block public access" ON emails
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Step 6: Create updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create trigger
DROP TRIGGER IF EXISTS update_emails_updated_at ON emails;
CREATE TRIGGER update_emails_updated_at
  BEFORE UPDATE ON emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Grant permissions to service_role
GRANT ALL ON emails TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;
