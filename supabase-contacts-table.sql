-- SQL to create contacts table in Supabase
-- Copy and paste ONLY the SQL below into Supabase SQL Editor

-- Step 1: Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create indexes
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

-- Step 3: Enable Row Level Security (RLS)
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can manage contacts" ON contacts;
DROP POLICY IF EXISTS "Enable insert for service role" ON contacts;
DROP POLICY IF EXISTS "Block public access" ON contacts;

-- Policy: Allow service_role (used by API) to insert contacts
CREATE POLICY "Enable insert for service role" ON contacts
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Policy: Allow service_role to read contacts (for admin purposes)
CREATE POLICY "Enable read for service role" ON contacts
  FOR SELECT
  USING (auth.role() = 'service_role');

-- Policy: Block all public/anonymous access (security)
CREATE POLICY "Block public access" ON contacts
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Step 5: Create updated_at trigger function (if it doesn't exist)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

