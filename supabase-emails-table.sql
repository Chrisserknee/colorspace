-- SQL to create emails table in Supabase
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Create emails table
CREATE TABLE IF NOT EXISTS emails (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  image_id UUID REFERENCES portraits(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'checkout',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_emails_email ON emails(email);

-- Create index for faster date-based queries
CREATE INDEX IF NOT EXISTS idx_emails_created_at ON emails(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;

-- Create policy to allow service role to insert/update/select
CREATE POLICY "Service role can manage emails" ON emails
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_emails_updated_at
  BEFORE UPDATE ON emails
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to service role
GRANT ALL ON emails TO service_role;
GRANT USAGE ON SCHEMA public TO service_role;

