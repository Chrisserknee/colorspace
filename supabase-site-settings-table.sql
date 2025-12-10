-- Site Settings Table for LumePet
-- Used to store site-wide configuration like generation guidance

-- Create the site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_site_settings_key ON site_settings(key);

-- Insert default empty guidance (optional)
INSERT INTO site_settings (key, value, updated_at)
VALUES ('generation_guidance', '', NOW())
ON CONFLICT (key) DO NOTHING;

-- Grant permissions (adjust based on your Supabase setup)
-- ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow read access" ON site_settings FOR SELECT USING (true);
-- CREATE POLICY "Allow admin write" ON site_settings FOR ALL USING (true);

